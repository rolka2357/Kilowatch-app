import { useEffect } from "react";

import { cancelKilosaveReminder } from "./kilosaveNotifications";

/**
 * Migration cleanup for the former local KiloSave alarm.
 *
 * KiloSave reminders are now delivered by kilowatch-backend through FCM, which
 * works while the app is closed and does not require the phone to arm an alarm.
 * Cancel any alarm left by an older app version to avoid duplicate reminders.
 */
export default function KilosaveReminderRunner() {
  useEffect(() => {
    cancelKilosaveReminder().catch((error) =>
      console.warn(
        "Legacy KiloSave reminder cleanup skipped",
        error?.message || error
      )
    );
  }, []);

  return null;
}
