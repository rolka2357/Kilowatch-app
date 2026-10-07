import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { onValue, ref } from "firebase/database";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import HeaderBackIcon from "../../../../assets/svg/room/header_back.svg";
import GlassPanel from "../../../components/room/GlassPanel";
import RoomDayNightBackground from "../../../components/room/RoomDayNightBackground";
import WheelPicker from "../../../components/room/WheelPicker";
import { database } from "../../../firebase/firebaseConfig";
import { paths } from "../../../firebase/dbPaths";
import {
  DAY_OPTIONS,
  deleteSchedule,
  formatScheduleDays,
  formatScheduleTime,
  saveSchedule,
  setScheduleEnabled,
} from "../../../firebase/schedules";
import { ensureScheduleNotificationsReady } from "../../../notifications/scheduleNotifications";
import { useHome } from "../../../context/HomeContext";
import { userFacingError } from "../../../utils/userFacingError";
import { createApplianceScheduleStyles } from "./ApplianceScheduleStyles";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, "0"),
}));
const AMPM = ["AM", "PM"];

function emptyDraft() {
  return {
    scheduleId: null,
    enabled: true,
    action: "off",
    hour12: 7,
    minute: 0,
    ampm: "AM",
    days: "everyday",
  };
}

function ScheduleEditor({
  styles,
  draft,
  setDraft,
  onSave,
  onCancel,
  onDelete,
  saving,
}) {
  const everyday = draft.days === "everyday";
  const selectedDays = Array.isArray(draft.days) ? draft.days : [];

  const toggleDay = (id) => {
    if (everyday) {
      setDraft((prev) => ({ ...prev, days: [id] }));
      return;
    }
    setDraft((prev) => {
      const set = new Set(Array.isArray(prev.days) ? prev.days : []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = [...set].sort((a, b) => a - b);
      if (next.length === 7) return { ...prev, days: "everyday" };
      return { ...prev, days: next };
    });
  };

  return (
    <GlassPanel
      style={styles.editorCard}
      contentStyle={styles.editorInner}
      blur={false}
    >
      <Text style={styles.sectionLabel}>ACTION</Text>
      <View style={styles.segmentRow}>
        {["on", "off"].map((action) => {
          const on = draft.action === action;
          return (
            <Pressable
              key={action}
              style={[styles.segment, on && styles.segmentOn]}
              onPress={() => setDraft((prev) => ({ ...prev, action }))}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                Turn {action === "on" ? "On" : "Off"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Wheels stay outside any ScrollView so one-finger drag works */}
      <Text style={styles.sectionLabel}>TIME</Text>
      <View style={styles.wheelsRow}>
        <WheelPicker
          values={HOURS}
          selected={draft.hour12}
          onChange={(hour12) => setDraft((prev) => ({ ...prev, hour12 }))}
          width={64}
          loop
        />
        <Text style={styles.colon}>:</Text>
        <WheelPicker
          values={MINUTE_OPTIONS}
          selected={draft.minute}
          onChange={(minute) => setDraft((prev) => ({ ...prev, minute }))}
          width={72}
          loop
        />
        <WheelPicker
          values={AMPM}
          selected={draft.ampm}
          onChange={(ampm) => setDraft((prev) => ({ ...prev, ampm }))}
          width={72}
        />
      </View>

      <ScrollView
        style={styles.editorBottomScroll}
        contentContainerStyle={styles.editorBottomContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>REPEAT</Text>
        <Pressable
          style={[styles.everydayChip, everyday && styles.dayChipOn]}
          onPress={() => setDraft((prev) => ({ ...prev, days: "everyday" }))}
        >
          <Text style={[styles.dayChipText, everyday && styles.dayChipTextOn]}>
            Every day
          </Text>
        </Pressable>
        <View style={styles.daysRow}>
          {DAY_OPTIONS.map((day) => {
            const on = !everyday && selectedDays.includes(day.id);
            return (
              <Pressable
                key={day.id}
                style={[styles.dayChip, on && styles.dayChipOn]}
                onPress={() => toggleDay(day.id)}
              >
                <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>
                  {day.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.editorActions}>
        {draft.scheduleId ? (
          <Pressable style={styles.dangerBtn} onPress={onDelete} disabled={saving}>
            <Text style={styles.dangerBtnText}>Delete</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.ghostBtn} onPress={onCancel} disabled={saving}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {draft.scheduleId ? "Save" : "Add Schedule"}
            </Text>
          )}
        </Pressable>
      </View>
    </GlassPanel>
  );
}

export default function ApplianceSchedule({ route, navigation }) {
  const styles = createApplianceScheduleStyles();
  const insets = useSafeAreaInsets();
  const { applianceId, roomId } = route.params || {};
  const { activeHomeOwnerUid, authUid, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;

  const [appliance, setAppliance] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  const deviceId = appliance?.deviceId;

  useEffect(() => {
    ensureScheduleNotificationsReady();
  }, []);

  useEffect(() => {
    if (!homeUid || !applianceId) return undefined;
    return onValue(
      ref(database, paths.appliance(homeUid, applianceId)),
      (snap) => {
        setAppliance(snap.val() ? { applianceId, ...snap.val() } : null);
      }
    );
  }, [homeUid, applianceId]);

  useEffect(() => {
    if (!homeUid || !deviceId) {
      setSchedules([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    return onValue(
      ref(database, paths.deviceSchedules(homeUid, deviceId)),
      (snap) => {
        const value = snap.val() || {};
        const list = Object.entries(value).map(([scheduleId, row]) => ({
          scheduleId,
          ...row,
        }));
        // Proper sort by minutes from midnight
        list.sort((a, b) => {
          const toM = (s) => {
            let h = Number(s.hour12) % 12;
            if (s.ampm === "PM") h += 12;
            return h * 60 + (Number(s.minute) || 0);
          };
          return toM(a) - toM(b);
        });
        setSchedules(list);
        setLoading(false);
      }
    );
  }, [homeUid, deviceId]);

  const title = useMemo(
    () => appliance?.name || "Schedule",
    [appliance?.name]
  );

  const openCreate = () => {
    if (!canEdit) {
      Alert.alert("View only", "Ask the home owner for Editor access.");
      return;
    }
    setDraft(emptyDraft());
    setEditing(true);
  };

  const openEdit = (item) => {
    if (!canEdit) return;
    setDraft({
      scheduleId: item.scheduleId,
      enabled: item.enabled !== false,
      action: item.action === "off" ? "off" : "on",
      hour12: Number(item.hour12) || 7,
      minute: Math.min(
        59,
        Math.max(
          0,
          Number.isFinite(Number(item.minute)) ? Number(item.minute) : 0
        )
      ),
      ampm: item.ampm === "PM" ? "PM" : "AM",
      days: item.days === "everyday" ? "everyday" : item.days || "everyday",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!homeUid || !deviceId) return;
    if (
      draft.days !== "everyday" &&
      (!Array.isArray(draft.days) || draft.days.length === 0)
    ) {
      Alert.alert("Pick days", "Choose Every day or at least one weekday.");
      return;
    }

    setSaving(true);
    try {
      await saveSchedule(homeUid, deviceId, draft);
      setEditing(false);
      setDraft(emptyDraft());
    } catch (error) {
      Alert.alert("Save failed", userFacingError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!draft.scheduleId) return;
    Alert.alert("Delete schedule?", "This alarm will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await deleteSchedule(homeUid, deviceId, draft.scheduleId);
            setEditing(false);
            setDraft(emptyDraft());
          } catch (error) {
            Alert.alert("Delete failed", userFacingError(error));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const toggleEnabled = async (item, enabled) => {
    if (!canEdit) return;
    try {
      await setScheduleEnabled(homeUid, deviceId, item.scheduleId, enabled);
    } catch (error) {
      Alert.alert("Update failed", userFacingError(error));
    }
  };

  if (!applianceId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyBody}>Appliance not found.</Text>
      </View>
    );
  }

  if (loading && !appliance) {
    return (
      <View style={styles.loadingContainer}>
        <RoomDayNightBackground />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <RoomDayNightBackground />

      {editing ? (
        <View
          style={[
            styles.content,
            styles.editorScreen,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 28,
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => {
                setEditing(false);
                setDraft(emptyDraft());
              }}
              hitSlop={12}
            >
              <HeaderBackIcon width={24} height={24} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Schedule
            </Text>
            <View style={styles.headerBtn} />
          </View>
          <Text style={styles.subtitle}>{title}</Text>

          <ScheduleEditor
            styles={styles}
            draft={draft}
            setDraft={setDraft}
            onSave={handleSave}
            onCancel={() => {
              setEditing(false);
              setDraft(emptyDraft());
            }}
            onDelete={handleDelete}
            saving={saving}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => navigation.goBack()}
              hitSlop={12}
            >
              <HeaderBackIcon width={24} height={24} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Schedule
            </Text>
            <View style={styles.headerBtn} />
          </View>
          <Text style={styles.subtitle}>{title}</Text>

          {schedules.length === 0 ? (
            <GlassPanel style={styles.emptyCard} contentStyle={styles.emptyInner}>
              <Text style={styles.emptyTitle}>No schedules yet</Text>
              <Text style={styles.emptyBody}>
                Add an alarm-style schedule to turn this plug on or off at a set
                time — every day or on custom weekdays.
              </Text>
            </GlassPanel>
          ) : (
            schedules.map((item) => {
              const isOnAction = item.action !== "off";
              return (
                <Pressable
                  key={item.scheduleId}
                  onPress={() => openEdit(item)}
                >
                  <GlassPanel
                    style={[
                      styles.scheduleCard,
                      item.enabled === false && { opacity: 0.55 },
                    ]}
                    contentStyle={styles.scheduleInner}
                  >
                    <View style={styles.scheduleTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.scheduleTime}>
                          {formatScheduleTime(
                            item.hour12,
                            item.minute,
                            item.ampm
                          )}
                        </Text>
                        <Text style={styles.scheduleMeta}>
                          {formatScheduleDays(item.days)}
                        </Text>
                      </View>
                      <Switch
                        value={item.enabled !== false}
                        onValueChange={(v) => toggleEnabled(item, v)}
                        disabled={!canEdit}
                        trackColor={{
                          false: "rgba(255,255,255,0.2)",
                          true: "rgba(254,96,35,0.8)",
                        }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <View
                      style={[
                        styles.actionPill,
                        isOnAction ? styles.actionPillOn : styles.actionPillOff,
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionPillText,
                          isOnAction
                            ? styles.actionPillTextOn
                            : styles.actionPillTextOff,
                        ]}
                      >
                        Turn {isOnAction ? "On" : "Off"}
                      </Text>
                    </View>
                  </GlassPanel>
                </Pressable>
              );
            })
          )}

          {canEdit ? (
            <Pressable onPress={openCreate}>
              <GlassPanel style={styles.addBtn} contentStyle={styles.addInner}>
                <Text style={styles.addText}>+ Add Schedule</Text>
              </GlassPanel>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
