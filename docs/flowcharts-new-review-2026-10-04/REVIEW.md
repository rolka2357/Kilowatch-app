# Flowchart new review — 2026-10-04

Backup of previous trees:
- D:\Kilowatch App\docs\flowcharts-backup-before-new-review-2026-10-04
- C:\Users\lenovo\Documents\Kilowatch Flowchart-backup-before-new-review-2026-10-04

## Reviewed vs current app

### Analytics — UPDATED (`analytics_tab_new`)
Mismatch fixed:
- Default period is Day (not Week)
- Your Consumption Trend and Your Comparison Trend are independent
- Comparison has its own Week/Month/Year chips + date nav (not "only Weekly wired")

### Settings home — UPDATED (`settings/1_settings_home_new`)
Mismatch fixed:
- Added Billing period row
- Security / Help / About navigate to real screens (not "coming soon")

### Account — UPDATED (`settings/2_account_new`)
Mismatch fixed:
- Transfer Ownership is a real flow (not disabled/coming soon)

### KiloSave home/goal — UPDATED (`kilosave/1_home_set_goal_new`)
Mismatch fixed:
- Goal lock for active billing period
- periodStart / billingDayOfMonth used when saving goal
- Edit Target Goal during active period removed; Start a new period when ended

### KiloSave overview — UPDATED (`kilosave/2_overview_tab_new`)
Mismatch fixed:
- Locked-goal note
- No Edit Target Goal button while period active
- Missed-week catch-up reminder path

### Onboarding — NEW (`onboarding/onboarding_flow_new`)
No prior flowchart existed. Added full stack:
Welcome → Video → Provider → Permissions → Bill Arrival → Main App

### Left unchanged (still aligned enough)
- kilosave/3_set_aside_money.*
- kilosave/4_history_log_bill.*
- settings/3_edit_name_email.*
- settings/4_electricity_rate.*
- settings/5_people_invite.*
- auth login/register/forgot_password
