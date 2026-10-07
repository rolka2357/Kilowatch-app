/**
 * PURPOSE: Multi-step smart-plug pairing wizard (QR → Wi‑Fi → EZ → name/room).
 * Claims global ownership, writes devices/{homeUid}/{deviceId}, reattaches
 * history, and rolls back incomplete pairings if the user backs out mid-flow.
 */
import { useEffect, useState } from "react";
import {
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";

import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { claimDeviceOwnership } from "../../firebase/deviceOwnership";
import { rollbackIncompletePairing } from "../../firebase/pairingRecovery";
import { reattachHistoryForPlug } from "../../firebase/historyLink";
import { tuyaActivator, tuyaDevice, stopActivatorConfig } from "../../tuya/tuyaBridge";
import { TUYA_NATIVE_ENABLED } from "../../tuya/tuyaNative";
import {
  ensureKilowatchHome,
  ensureTuyaSession,
  extractHomeId,
} from "../../tuya/tuyaSession";
import ConnectWifiModal from "./ConnectWifiModal";
import ConnectingModal from "./ConnectingModal";
import ConnectionSuccessModal from "./ConnectionSuccessModal";
import EnterApplianceDetailsModal from "./EnterApplianceDetailsModal";
import { checkSmartPlugAvailability } from "./deviceAvailability";
import {
  getDeviceId,
  isWifiScannerAvailable,
  openSystemWifiSettings,
  prepareWifiNetworks,
} from "./pairingUtils";
import ScanQrModal from "./ScanQrModal";
import { useHome } from "../../context/HomeContext";
import { userFacingError } from "../../utils/userFacingError";

const STEPS = {
  SCAN: "scan",
  WIFI: "wifi",
  CONNECTING: "connecting",
  SUCCESS: "success",
  DETAILS: "details",
};

const NEW_ROOM_ID = "__new__";

// Metro builds skip ThingHomeSdk.init — pairing requires a release APK.
const METRO_PAIRING_MESSAGE =
  "Adding a smart plug needs the release Kilowatch app (not Metro). " +
  "Install dist/kilowatch-v1.0.14.apk, pair there, then you can use Metro again for testing. " +
  "Toggle, schedules, and usage limits still run through the backend.";

export default function AddApplianceFlow({ visible, onClose, onComplete }) {
  const { activeHomeOwnerUid, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;
  const [step, setStep] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [ssid, setSsid] = useState("");
  const [phoneSsid, setPhoneSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [networks, setNetworks] = useState([]);
  const [scannerAvailable, setScannerAvailable] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [checkingId, setCheckingId] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [applianceName, setApplianceName] = useState("");
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [pairedDevice, setPairedDevice] = useState(null);
  const [notice, setNotice] = useState("");

  const resetUiState = () => {
    setStep(null);
    setIdentifier("");
    setSsid("");
    setPhoneSsid("");
    setWifiPassword("");
    setNetworks([]);
    setScannerAvailable(true);
    setScanning(false);
    setPreparing(false);
    setCheckingId(false);
    setSaving(false);
    setError("");
    setNotice("");
    setApplianceName("");
    setRooms([]);
    setSelectedRoomId(null);
    setNewRoomName("");
    setPairedDevice(null);
    stopActivatorConfig();
  };

  const finishAndClose = () => {
    stopActivatorConfig();
    resetUiState();
    onClose();
  };

  // Closing after EZ success but before naming leaves an orphan device row —
  // roll that back so the same QR can be paired again.
  const handleClose = () => {
    stopActivatorConfig();
    const device = pairedDevice;
    const ownerUid = homeUid || auth.currentUser?.uid;
    const shouldRollback =
      device?.deviceId &&
      ownerUid &&
      (step === STEPS.SUCCESS || step === STEPS.DETAILS);

    resetUiState();
    onClose();

    if (shouldRollback) {
      rollbackIncompletePairing(ownerUid, device.deviceId, identifier).catch(
        (rollbackError) =>
          console.warn("Pairing rollback skipped", rollbackError)
      );
    }
  };

  useEffect(() => {
    if (visible) {
      setStep(STEPS.SCAN);
      setError(TUYA_NATIVE_ENABLED ? "" : METRO_PAIRING_MESSAGE);
    } else {
      resetUiState();
    }
  }, [visible]);

  // Availability check may resume an incomplete pairing straight into DETAILS.
  const openWifiStep = async () => {
    setError("");
    setCheckingId(true);

    try {
      const availability = await checkSmartPlugAvailability(
        auth.currentUser,
        identifier,
        homeUid
      );

      if (!availability.ok) {
        setError(availability.message);
        return;
      }

      if (availability.resumeDevice) {
        const resume = availability.resumeDevice;
        setPairedDevice({
          deviceId: resume.deviceId,
          homeId: resume.homeId,
          productId: resume.productId || null,
        });
        setNotice(
          "This plug was already connected. Choose a name and room to finish adding it."
        );
        setError("");
        setStep(STEPS.DETAILS);
        return;
      }

      if (!TUYA_NATIVE_ENABLED) {
        setError(METRO_PAIRING_MESSAGE);
        return;
      }

      setNotice("");
      setPreparing(true);
      setStep(STEPS.WIFI);

      await ensureTuyaSession(auth.currentUser);
      const {
        networks: found,
        selectedSsid,
        phoneSsid: connectedSsid,
        scannerAvailable: canScan,
      } = await prepareWifiNetworks();
      setNetworks(found);
      setSsid(selectedSsid);
      setPhoneSsid(connectedSsid || selectedSsid || "");
      setScannerAvailable(canScan);
    } catch (prepareError) {
      setError(
        userFacingError(prepareError, "Unable to prepare Wi-Fi pairing.")
      );
      setStep(STEPS.SCAN);
    } finally {
      setCheckingId(false);
      setPreparing(false);
    }
  };

  const rescanNetworks = async () => {
    if (!isWifiScannerAvailable()) {
      openSystemWifiSettings();
      setError(
        "Choose a 2.4 GHz network in Android Wi-Fi settings, then return and reopen this step."
      );
      return;
    }

    setScanning(true);
    setError("");
    try {
      const {
        networks: found,
        selectedSsid,
        phoneSsid: connectedSsid,
      } = await prepareWifiNetworks();
      setNetworks(found);
      setPhoneSsid(connectedSsid || selectedSsid || phoneSsid || "");
      if (!found.some((network) => network.ssid === ssid)) {
        setSsid(selectedSsid || found[0]?.ssid || "");
      }
    } catch (scanError) {
      setError(userFacingError(scanError, "Unable to scan Wi-Fi networks."));
    } finally {
      setScanning(false);
    }
  };

  /** EZ Mode activator → claim ownership → write device row → reattach history. */
  const pairAdapter = async () => {
    if (!ssid.trim() || !wifiPassword) {
      setError("Select your 2.4 GHz Wi-Fi network and enter its password.");
      return;
    }

    setError("");

    // Re-check before EZ in case ownership changed while the Wi‑Fi modal was open
    // (e.g. transfer), or the QR pre-check was stale.
    try {
      const prePairAvailability = await checkSmartPlugAvailability(
        auth.currentUser,
        identifier,
        homeUid
      );
      if (!prePairAvailability.ok) {
        setError(prePairAvailability.message);
        setStep(STEPS.SCAN);
        return;
      }
    } catch (preCheckError) {
      setError(
        userFacingError(preCheckError, "Unable to verify plug availability.")
      );
      setStep(STEPS.SCAN);
      return;
    }

    setStep(STEPS.CONNECTING);

    try {
      const user = auth.currentUser;
      await ensureTuyaSession(user);
      const home = await ensureKilowatchHome();
      const homeId = extractHomeId(home);

      if (!Number.isFinite(homeId)) {
        throw new Error("Tuya did not return a valid home ID.");
      }

      const device = await tuyaActivator.initActivator({
        homeId,
        ssid: ssid.trim(),
        password: wifiPassword,
        time: 90,
        type: "THING_EZ",
      });

      const deviceId = getDeviceId(device);
      if (!deviceId) {
        throw new Error("The plug paired, but no device ID was returned.");
      }

      // Re-check global map after EZ (QR pre-check may not know Tuya deviceId yet).
      const postPairAvailability = await checkSmartPlugAvailability(
        user,
        deviceId,
        homeUid || user.uid
      );
      if (!postPairAvailability.ok) {
        try {
          await tuyaDevice.removeDevice({ devId: deviceId });
        } catch (releaseError) {
          console.warn("Unable to unbind rejected plug from Tuya", releaseError);
        }
        throw new Error(postPairAvailability.message);
      }

      const claim = await claimDeviceOwnership(
        homeUid || user.uid,
        deviceId,
        identifier
      );

      if (!claim.ok) {
        // Don't leave the plug bound to this Tuya home if another Kilowatch
        // account already owns it.
        try {
          await tuyaDevice.removeDevice({ devId: deviceId });
        } catch (releaseError) {
          console.warn("Unable to unbind rejected plug from Tuya", releaseError);
        }
        throw new Error(claim.message);
      }

      const ownerUid = homeUid || user.uid;
      await set(ref(database, paths.device(ownerUid, deviceId)), {
        deviceId,
        homeId,
        identifier: identifier.trim() || null,
        productId: device.productId || null,
        provider: "tuya",
        pairedAt: Date.now(),
        roomId: null,
        applianceId: null,
        online: Boolean(device.isOnline ?? device.online),
        switchOn: Boolean(device.dps?.["1"]),
        updatedAt: Date.now(),
      });

      // Same QR/box id after delete → move retained history onto this deviceId
      // when Tuya issued a new id (no-op if the id is unchanged).
      try {
        await reattachHistoryForPlug(ownerUid, identifier, deviceId);
      } catch (historyError) {
        console.warn("History reattach skipped", historyError);
      }

      setPairedDevice({ ...device, deviceId, homeId });
      setStep(STEPS.SUCCESS);
    } catch (pairError) {
      try {
        stopActivatorConfig();
      } catch (_) {
        // ignore
      }

      const message = String(pairError?.message || "");
      if (/already registered to another/i.test(message)) {
        setError(message);
      } else if (/already have this smart plug/i.test(message)) {
        setError(message);
      } else {
        setError(
          userFacingError(
            pairError,
            "Could not connect the smart plug to Wi-Fi. Confirm the hotspot is 2.4 GHz, the password is correct, the plug is blinking rapidly (pairing mode), and try again."
          )
        );
      }
      setStep(STEPS.WIFI);
    }
  };

  useEffect(() => {
    if (step !== STEPS.DETAILS || !homeUid) return undefined;

    return onValue(ref(database, paths.rooms(homeUid)), (snapshot) => {
      const value = snapshot.val() || {};
      const list = Object.entries(value)
        .map(([roomId, room]) => ({ roomId, ...room }))
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );

      setRooms(list);
      setSelectedRoomId((current) => {
        if (current === NEW_ROOM_ID) return current;
        if (current && list.some((room) => room.roomId === current)) {
          return current;
        }
        if (list.length === 0) return NEW_ROOM_ID;
        return list[0].roomId;
      });
    });
  }, [step, homeUid]);

  /** Create appliance (+ optional room) and link device.applianceId to finish. */
  const saveApplianceDetails = async () => {
    if (!applianceName.trim()) {
      setError("Enter the appliance name.");
      return;
    }

    const creatingRoom =
      selectedRoomId === NEW_ROOM_ID || rooms.length === 0;
    if (creatingRoom && !newRoomName.trim()) {
      setError("Enter a name for the new room.");
      return;
    }
    if (!creatingRoom && !selectedRoomId) {
      setError("Select a room or create a new one.");
      return;
    }

    if (!pairedDevice?.deviceId) {
      setError("Missing paired device. Please restart the setup flow.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const user = auth.currentUser;
      const ownerUid = homeUid || user?.uid;
      if (!ownerUid) {
        setError("Please sign in again.");
        setSaving(false);
        return;
      }

      let roomId = selectedRoomId;

      if (creatingRoom) {
        const roomRef = push(ref(database, paths.rooms(ownerUid)));
        roomId = roomRef.key;
        await set(roomRef, {
          roomId,
          name: newRoomName.trim(),
          imageUri: null,
          createdAt: Date.now(),
        });
      }

      const applianceRef = push(ref(database, paths.appliances(ownerUid)));

      await set(applianceRef, {
        applianceId: applianceRef.key,
        name: applianceName.trim(),
        deviceId: pairedDevice.deviceId,
        roomId,
        createdAt: Date.now(),
      });

      await update(
        ref(database, paths.device(ownerUid, pairedDevice.deviceId)),
        {
          roomId,
          applianceId: applianceRef.key,
        }
      );

      finishAndClose();
      onComplete?.({
        roomId,
        applianceId: applianceRef.key,
        deviceId: pairedDevice.deviceId,
      });
    } catch (saveError) {
      setError(userFacingError(saveError, "Unable to save appliance details."));
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !step) return null;

  return (
    <>
      <ScanQrModal
        visible={step === STEPS.SCAN}
        identifier={identifier}
        checking={checkingId}
        error={error}
        onChangeIdentifier={(value) => {
          setIdentifier(value);
          if (error) setError("");
        }}
        onConfirm={openWifiStep}
        onClose={handleClose}
      />

      <ConnectWifiModal
        visible={step === STEPS.WIFI}
        ssid={ssid}
        phoneSsid={phoneSsid}
        wifiPassword={wifiPassword}
        networks={networks}
        scannerAvailable={scannerAvailable}
        scanning={scanning}
        preparing={preparing}
        error={error}
        onChangeSsid={setSsid}
        onChangePassword={setWifiPassword}
        onRescan={rescanNetworks}
        onConfirm={pairAdapter}
        onClose={handleClose}
      />

      <ConnectingModal
        visible={step === STEPS.CONNECTING}
        onCancel={() => {
          stopActivatorConfig();
          setStep(STEPS.WIFI);
        }}
      />

      <ConnectionSuccessModal
        visible={step === STEPS.SUCCESS}
        onContinue={() => {
          setError("");
          setNotice("");
          setSelectedRoomId(null);
          setNewRoomName("");
          setStep(STEPS.DETAILS);
        }}
        onClose={handleClose}
      />

      <EnterApplianceDetailsModal
        visible={step === STEPS.DETAILS}
        applianceName={applianceName}
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        newRoomName={newRoomName}
        saving={saving}
        error={error}
        notice={notice}
        onChangeApplianceName={setApplianceName}
        onSelectRoom={setSelectedRoomId}
        onChangeNewRoomName={setNewRoomName}
        onConfirm={saveApplianceDetails}
        onClose={handleClose}
      />
    </>
  );
}
