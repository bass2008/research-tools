package com.arcanasense.daily

import java.time.Duration
import java.time.LocalDate
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DailyCalendarTest {
  @Test fun calendarMatchesTheApp() {
    assertEquals(13, DailyCalendar.arcanum(LocalDate.of(1970, 1, 1)))
    assertEquals(6, DailyCalendar.arcanum(LocalDate.of(1969, 12, 31)))
    for (day in 0L..365L) {
      val date = LocalDate.of(2026, 1, 1).plusDays(day)
      assertEquals(DailyCalendar.arcanum(date), DailyCalendar.arcanum(date.plusDays(22)))
    }
  }

  @Test fun dailyReminderFollowsLocalClockAcrossDaylightSaving() {
    val spring = ZonedDateTime.parse("2026-03-28T09:00:00+01:00[Europe/Berlin]")
    val autumn = ZonedDateTime.parse("2026-10-24T09:00:00+02:00[Europe/Berlin]")
    assertEquals(23L, Duration.between(spring, DailyCalendar.next(spring, 9, 0)).toHours())
    assertEquals(25L, Duration.between(autumn, DailyCalendar.next(autumn, 9, 0)).toHours())
  }

  @Test fun nextReminderUsesTodayOnlyBeforeTheChosenTime() {
    val before = ZonedDateTime.parse("2026-11-09T08:59:00+03:00[Europe/Moscow]")
    assertEquals("2026-11-09T09:00+03:00[Europe/Moscow]", DailyCalendar.next(before, 9, 0).toString())
    assertEquals("2026-11-10T00:00+03:00[Europe/Moscow]", DailyCalendar.next(before, 0, 0).toString())
  }

  @Test fun overdueAlarmNeverDeliversBeforeTheNewLocalTime() {
    val before = ZonedDateTime.parse("2026-11-11T08:59:40+03:00[Europe/Moscow]")
    assertFalse(DailyCalendar.timeReached(before, 9, 0))
    assertTrue(DailyCalendar.timeReached(before.plusSeconds(20), 9, 0))
  }
}
