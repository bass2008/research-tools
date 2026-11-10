package com.arcanasense.daily

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class ArcanaDailyModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  private fun state(): Map<String, Any> {
    val prefs = DailyScheduler.prefs(context)
    return mapOf("enabled" to (prefs.getBoolean("enabled", false) && DailyScheduler.permitted(context)),
      "hour" to prefs.getInt("hour", 9), "minute" to prefs.getInt("minute", 0),
      "locale" to (prefs.getString("locale", "ru") ?: "ru"))
  }

  override fun definition() = ModuleDefinition {
    Name("ArcanaDaily")
    AsyncFunction("getState") { state() }
    AsyncFunction("configure") { locale: String, titles: List<String> ->
      require(locale in listOf("ru", "en") && titles.size == 22)
      DailyScheduler.prefs(context).edit().putString("locale", locale)
        .putString("titles", JSONArray(titles).toString()).commit()
      DailyScheduler.channel(context)
      DailyScheduler.schedule(context)
      state()
    }
    AsyncFunction("setReminder") { enabled: Boolean, hour: Int, minute: Int ->
      require(hour in 0..23 && minute in 0..59)
      val allowed = !enabled || DailyScheduler.permitted(context)
      DailyScheduler.prefs(context).edit().putBoolean("enabled", enabled && allowed)
        .putInt("hour", hour).putInt("minute", minute).commit()
      DailyScheduler.schedule(context, resetReminder = true)
      state()
    }
    AsyncFunction("schedule") { DailyScheduler.schedule(context) }
  }
}
