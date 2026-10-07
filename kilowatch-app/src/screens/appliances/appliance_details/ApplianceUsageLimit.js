import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { onValue, ref } from "firebase/database";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import HeaderBackIcon from "../../../../assets/svg/room/header_back.svg";
import GlassPanel from "../../../components/room/GlassPanel";
import RoomDayNightBackground from "../../../components/room/RoomDayNightBackground";
import { database } from "../../../firebase/firebaseConfig";
import { paths } from "../../../firebase/dbPaths";
import {
  DAY_OPTIONS,
  deleteUsageLimit,
  formatLimitPhp,
  formatScheduleDays,
  limitPhpToKwh,
  saveUsageLimit,
  setUsageLimitEnabled,
} from "../../../firebase/usageLimits";
import { ensureScheduleNotificationsReady } from "../../../notifications/scheduleNotifications";
import useElectricityRate from "../../../hooks/useElectricityRate";
import { useHome } from "../../../context/HomeContext";
import { formatKwhChip } from "../../../utils/formatMoney";
import { userFacingError } from "../../../utils/userFacingError";
import { createApplianceScheduleStyles } from "./ApplianceScheduleStyles";

function emptyDraft() {
  return {
    limitId: null,
    enabled: true,
    limitPhpText: "15",
    days: "everyday",
    notifyEnabled: true,
    autoOffEnabled: true,
  };
}

function LimitEditor({
  styles,
  draft,
  setDraft,
  onSave,
  onCancel,
  onDelete,
  saving,
  rate,
  providerName,
}) {
  const everyday = draft.days === "everyday";
  const selectedDays = Array.isArray(draft.days) ? draft.days : [];
  const limitPhp = Math.max(0, Number(String(draft.limitPhpText).replace(",", ".")) || 0);
  const kwh = limitPhpToKwh(limitPhp, rate);

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
      <Text style={styles.sectionLabel}>SPENDING LIMIT</Text>
      <View style={styles.limitInputRow}>
        <Text style={styles.limitCurrency}>₱</Text>
        <TextInput
          style={styles.limitInput}
          value={draft.limitPhpText}
          onChangeText={(limitPhpText) =>
            setDraft((prev) => ({
              ...prev,
              limitPhpText: limitPhpText.replace(/[^0-9.]/g, ""),
            }))
          }
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="rgba(255,255,255,0.35)"
          returnKeyType="done"
        />
      </View>
      <Text style={styles.limitHint}>
        ≈ {formatKwhChip(kwh)} kWh at ₱{Number(rate || 0).toFixed(2)}/kWh
        {providerName ? ` (${providerName})` : ""}. Choose how to react when today’s
        cost for this plug reaches your limit.
      </Text>

      <ScrollView
        style={styles.editorBottomScroll}
        contentContainerStyle={styles.editorBottomContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>WHEN LIMIT IS HIT</Text>
        <View style={styles.optionRow}>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>Notifications</Text>
            <Text style={styles.optionBody}>
              Alert when the limit is reached. If auto turn off is off, the
              notification includes Turn off now and Turn off manually.
            </Text>
          </View>
          <Switch
            value={draft.notifyEnabled !== false}
            onValueChange={(notifyEnabled) =>
              setDraft((prev) => ({ ...prev, notifyEnabled }))
            }
            trackColor={{
              false: "rgba(255,255,255,0.2)",
              true: "rgba(254,96,35,0.8)",
            }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.optionRow}>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>Auto turn off</Text>
            <Text style={styles.optionBody}>
              Automatically turn off this smart plug when the limit is hit.
            </Text>
          </View>
          <Switch
            value={draft.autoOffEnabled !== false}
            onValueChange={(autoOffEnabled) =>
              setDraft((prev) => ({ ...prev, autoOffEnabled }))
            }
            trackColor={{
              false: "rgba(255,255,255,0.2)",
              true: "rgba(254,96,35,0.8)",
            }}
            thumbColor="#FFFFFF"
          />
        </View>

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
        {draft.limitId ? (
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
              {draft.limitId ? "Save" : "Add Limit"}
            </Text>
          )}
        </Pressable>
      </View>
    </GlassPanel>
  );
}

export default function ApplianceUsageLimit({ route, navigation }) {
  const styles = createApplianceScheduleStyles();
  const insets = useSafeAreaInsets();
  const { applianceId, roomId } = route.params || {};
  const { activeHomeOwnerUid, authUid, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;
  const { rate, providerName, loading: rateLoading } = useElectricityRate({
    useActiveHome: true,
  });

  const [appliance, setAppliance] = useState(null);
  const [limits, setLimits] = useState([]);
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
      setLimits([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    return onValue(
      ref(database, paths.deviceUsageLimits(homeUid, deviceId)),
      (snap) => {
        const value = snap.val() || {};
        const list = Object.entries(value).map(([limitId, row]) => ({
          limitId,
          ...row,
        }));
        list.sort((a, b) => Number(a.limitPhp || 0) - Number(b.limitPhp || 0));
        setLimits(list);
        setLoading(false);
      }
    );
  }, [homeUid, deviceId]);

  const title = useMemo(
    () => appliance?.name || "Usage Limit",
    [appliance?.name]
  );

  const openCreate = () => {
    if (!canEdit) {
      Alert.alert("View only", "Ask the home owner for Editor access.");
      return;
    }
    const defaultPhp =
      Number.isFinite(Number(rate)) && Number(rate) > 0
        ? String(Math.round(Number(rate)))
        : "15";
    const start = () => {
      setDraft({ ...emptyDraft(), limitPhpText: defaultPhp });
      setEditing(true);
    };
    if (limits.length > 0) {
      Alert.alert(
        "Add another limit?",
        "You already have a usage limit on this plug. Extra near-duplicate limits can each send their own notification. Edit the existing one unless you really want a second threshold.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add another", onPress: start },
        ]
      );
      return;
    }
    start();
  };

  const openEdit = (item) => {
    if (!canEdit) return;
    const php = Number(item.limitPhp);
    setDraft({
      limitId: item.limitId,
      enabled: item.enabled !== false,
      limitPhpText: Number.isFinite(php) ? String(php) : "15",
      days: item.days === "everyday" ? "everyday" : item.days || "everyday",
      notifyEnabled: item.notifyEnabled !== false,
      autoOffEnabled: item.autoOffEnabled !== false,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!homeUid || !deviceId) return;
    const limitPhp = Math.max(
      0,
      Number(String(draft.limitPhpText).replace(",", ".")) || 0
    );
    if (!(limitPhp > 0)) {
      Alert.alert("Enter a limit", "Set a spending amount greater than ₱0.");
      return;
    }
    if (
      draft.days !== "everyday" &&
      (!Array.isArray(draft.days) || draft.days.length === 0)
    ) {
      Alert.alert("Pick days", "Choose Every day or at least one weekday.");
      return;
    }
    if (draft.notifyEnabled === false && draft.autoOffEnabled === false) {
      Alert.alert(
        "Pick an action",
        "Turn on Notifications and/or Auto turn off so the limit can do something."
      );
      return;
    }

    setSaving(true);
    try {
      await saveUsageLimit(homeUid, deviceId, {
        ...draft,
        limitPhp,
      });
      setEditing(false);
      setDraft(emptyDraft());
    } catch (error) {
      Alert.alert("Save failed", userFacingError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!draft.limitId) return;
    Alert.alert("Delete usage limit?", "This limit will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await deleteUsageLimit(homeUid, deviceId, draft.limitId);
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
      await setUsageLimitEnabled(homeUid, deviceId, item.limitId, enabled);
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

  if ((loading && !appliance) || rateLoading) {
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
              Usage Limit
            </Text>
            <View style={styles.headerBtn} />
          </View>
          <Text style={styles.subtitle}>{title}</Text>

          <LimitEditor
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
            rate={rate}
            providerName={providerName}
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
          keyboardShouldPersistTaps="handled"
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
              Usage Limit
            </Text>
            <View style={styles.headerBtn} />
          </View>
          <Text style={styles.subtitle}>{title}</Text>

          {limits.length === 0 ? (
            <GlassPanel style={styles.emptyCard} contentStyle={styles.emptyInner}>
              <Text style={styles.emptyTitle}>No usage limits yet</Text>
              <Text style={styles.emptyBody}>
                Cap today’s spend for this plug (for example ₱{Number(rate || 15).toFixed(0)} ≈ 1
                kWh at your {providerName || "provider"} rate). Applies every day or on selected
                weekdays.
              </Text>
            </GlassPanel>
          ) : (
            limits.map((item) => {
              const kwh = limitPhpToKwh(item.limitPhp, rate);
              const notifyOn = item.notifyEnabled !== false;
              const autoOffOn = item.autoOffEnabled !== false;
              return (
                <Pressable key={item.limitId} onPress={() => openEdit(item)}>
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
                          {formatLimitPhp(item.limitPhp)}
                        </Text>
                        <Text style={styles.scheduleMeta}>
                          {formatScheduleDays(item.days)} · ≈ {formatKwhChip(kwh)} kWh
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
                    <View style={styles.pillRow}>
                      {notifyOn ? (
                        <View style={styles.actionPill}>
                          <Text style={styles.actionPillText}>Notify</Text>
                        </View>
                      ) : null}
                      {autoOffOn ? (
                        <View style={[styles.actionPill, styles.actionPillOff]}>
                          <Text
                            style={[
                              styles.actionPillText,
                              styles.actionPillTextOff,
                            ]}
                          >
                            Auto off
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.actionPill}>
                          <Text style={styles.actionPillText}>Manual from notif</Text>
                        </View>
                      )}
                    </View>
                  </GlassPanel>
                </Pressable>
              );
            })
          )}

          {canEdit ? (
            <Pressable onPress={openCreate}>
              <GlassPanel style={styles.addBtn} contentStyle={styles.addInner}>
                <Text style={styles.addText}>+ Add Usage Limit</Text>
              </GlassPanel>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
