package com.arcanasense.daily

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

object DailyCalendar {
  fun arcanum(date: LocalDate): Int = Math.floorMod(date.toEpochDay() * 7 + 12, 22).toInt() + 1

  fun timeReached(now: ZonedDateTime, hour: Int, minute: Int): Boolean =
    !now.toLocalTime().isBefore(LocalTime.of(hour, minute))

  fun next(now: ZonedDateTime, hour: Int, minute: Int): ZonedDateTime {
    val today = now.toLocalDate().atTime(hour, minute).atZone(now.zone)
    return if (today.isAfter(now)) today else now.toLocalDate().plusDays(1).atTime(hour, minute).atZone(now.zone)
  }
}
