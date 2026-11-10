package com.arcanasense.daily

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import java.time.ZonedDateTime
import org.json.JSONArray

object DailyScheduler {
  const val REMIND = "com.arcanasense.daily.REMIND"
  const val MIDNIGHT = "com.arcanasense.daily.MIDNIGHT"
  const val CHANNEL = "daily-theme"
  private const val NOTIFICATION = 4004

  fun prefs(context: Context) = context.getSharedPreferences("arcana.daily", Context.MODE_PRIVATE)
  private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)
  private fun provider(context: Context) = ComponentName(context.packageName, "${context.packageName}.widget.DailyTheme")

  fun permitted(context: Context): Boolean = manager(context).areNotificationsEnabled() &&
    manager(context).getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE

  fun channel(context: Context) {
    val ru = prefs(context).getString("locale", "ru") == "ru"
    manager(context).createNotificationChannel(NotificationChannel(CHANNEL,
      if (ru) "Тема дня" else "Today’s theme", NotificationManager.IMPORTANCE_DEFAULT))
  }

  private fun alarm(context: Context, action: String): PendingIntent = PendingIntent.getBroadcast(
    context, 0, Intent(context, DailyReceiver::class.java).setAction(action),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  fun schedule(context: Context, resetReminder: Boolean = false) {
    val prefs = prefs(context)
    val alarms = context.getSystemService(AlarmManager::class.java)
    val now = ZonedDateTime.now()
    val reminder = alarm(context, REMIND)
    if (prefs.getBoolean("enabled", false) && permitted(context)) {
      val previous = prefs.getLong("scheduledAt", 0)
      val nowMillis = now.toInstant().toEpochMilli()
      // A foreground refresh must not cancel an overdue alarm Android is about to deliver.
      val pendingDelivery = previous > 0 && previous <= nowMillis && nowMillis - previous < 3_600_000
      if (resetReminder || !pendingDelivery) {
        val next = DailyCalendar.next(now, prefs.getInt("hour", 9), prefs.getInt("minute", 0))
        val at = next.toInstant().toEpochMilli()
        prefs.edit().putLong("scheduledAt", at).apply()
        // No exact-alarm access: Android may defer delivery while conserving battery.
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, reminder)
      }
    } else {
      alarms.cancel(reminder)
      prefs.edit().remove("scheduledAt").apply()
      manager(context).cancel(NOTIFICATION)
    }

    val midnight = alarm(context, MIDNIGHT)
    alarms.cancel(midnight)
    if (AppWidgetManager.getInstance(context).getAppWidgetIds(provider(context)).isNotEmpty()) {
      alarms.set(AlarmManager.RTC, DailyCalendar.next(now, 0, 0).toInstant().toEpochMilli(), midnight)
    }
  }

  fun refreshWidget(context: Context) {
    val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(provider(context))
    if (ids.isNotEmpty()) context.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
      .setComponent(provider(context)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids))
  }

  fun notify(context: Context) {
    val prefs = prefs(context)
    if (!prefs.getBoolean("enabled", false) || !permitted(context)) return
    val now = ZonedDateTime.now()
    // A clock/timezone change can deliver yesterday's overdue alarm before today's chosen time.
    if (!DailyCalendar.timeReached(now, prefs.getInt("hour", 9), prefs.getInt("minute", 0))) return
    val today = now.toLocalDate()
    if (prefs.getString("delivered", "") == today.toString()) return
    val titles = JSONArray(prefs.getString("titles", "[]"))
    val title = titles.optString(DailyCalendar.arcanum(today) - 1)
    if (title.isBlank()) return
    channel(context)
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("arcanasense:///"))
      .setClassName(context.packageName, "${context.packageName}.MainActivity")
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val open = PendingIntent.getActivity(context, NOTIFICATION, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val icon = context.resources.getIdentifier("ic_daily_notification", "drawable", context.packageName)
    val notification = Notification.Builder(context, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle(if (prefs.getString("locale", "ru") == "ru") "Тема дня" else "Today’s theme")
      .setContentText(title).setStyle(Notification.BigTextStyle().bigText(title))
      .setContentIntent(open).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).build()
    manager(context).notify(NOTIFICATION, notification)
    prefs.edit().putString("delivered", today.toString()).apply()
  }
}

class DailyReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == DailyScheduler.REMIND) DailyScheduler.notify(context)
    else DailyScheduler.refreshWidget(context)
    DailyScheduler.schedule(context, resetReminder = intent.action != DailyScheduler.MIDNIGHT)
  }
}
