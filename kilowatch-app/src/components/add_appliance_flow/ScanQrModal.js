import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import ArrowIcon from "../../../assets/svg/shared/button_arrow_icon.svg";
import ModalShell from "../modal/ModalShell";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createAddApplianceFlowStyles } from "./AddApplianceFlowStyles";
import { parseSmartPlugQrPayload } from "./parseSmartPlugQr";

export default function ScanQrModal({
  visible,
  identifier,
  checking,
  error,
  onChangeIdentifier,
  onConfirm,
  onClose,
}) {
  const flowStyles = useThemedStyles(createAddApplianceFlowStyles);
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedLock, setScannedLock] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const lastScanRef = useRef("");

  useEffect(() => {
    if (!visible) {
      setScannedLock(false);
      setCameraReady(false);
      lastScanRef.current = "";
      return;
    }

    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // Unlock the scanner when the user edits the ID manually.
  useEffect(() => {
    if (!identifier || identifier !== lastScanRef.current) {
      setScannedLock(false);
    }
  }, [identifier]);

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      if (!visible || scannedLock || checking) return;

      const parsed = parseSmartPlugQrPayload(data);
      if (!parsed) return;

      setScannedLock(true);
      lastScanRef.current = parsed;
      onChangeIdentifier(parsed);
    },
    [visible, scannedLock, checking, onChangeIdentifier]
  );

  const permissionGranted = Boolean(permission?.granted);

  return (
    <ModalShell
      visible={visible}
      title="Scan your KiloWatch Adapter"
      onClose={onClose}
      footer={
        <Pressable
          style={[
            flowStyles.primaryButton,
            (checking || !String(identifier || "").trim()) &&
              flowStyles.primaryButtonDisabled,
          ]}
          disabled={checking || !String(identifier || "").trim()}
          onPress={onConfirm}
        >
          {checking ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={flowStyles.primaryButtonText}>Confirm</Text>
              <ArrowIcon color="#FCFCFC" width={12} height={10} />
            </>
          )}
        </Pressable>
      }
    >
      <View style={flowStyles.mainQrContainer}>
        <View style={flowStyles.scanFrame}>
          {permissionGranted ? (
            <>
              <CameraView
                style={flowStyles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={
                  scannedLock || checking ? undefined : handleBarcodeScanned
                }
                onCameraReady={() => setCameraReady(true)}
              />
              <View style={flowStyles.scanOverlay} pointerEvents="none">
                <View style={flowStyles.scanFrameInner} />
              </View>
              {!cameraReady ? (
                <View style={flowStyles.cameraLoading}>
                  <ActivityIndicator color="#FE6023" />
                </View>
              ) : null}
            </>
          ) : (
            <View style={flowStyles.cameraPermissionBox}>
              <Text style={flowStyles.scanPlaceholder}>
                Camera access is needed to scan the adapter QR code.
              </Text>
              <Pressable
                style={flowStyles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={flowStyles.permissionButtonText}>
                  Allow Camera
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={flowStyles.scanPlaceholder}>
          {scannedLock
            ? "QR detected. Confirm below, or scan again after editing the ID."
            : "Point your camera at the QR code on the adapter box."}
        </Text>

        <View style={flowStyles.stepRow}>
          <View style={flowStyles.stepIcon}>
            <Text style={flowStyles.stepIconText}>#</Text>
          </View>
          <Text style={flowStyles.stepText}>
            Find the QR code on your KiloWatch adapter and hold it up to the
            camera frame above.
          </Text>
        </View>

        <View style={flowStyles.stepRow}>
          <View style={flowStyles.stepIcon}>
            <Text style={flowStyles.stepIconText}>◎</Text>
          </View>
          <Text style={flowStyles.stepText}>
            For best results, make sure the code is well-lit and fully visible.
          </Text>
        </View>

        <Text style={flowStyles.label}>Or enter device ID manually</Text>
        <TextInput
          style={flowStyles.input}
          value={identifier}
          onChangeText={onChangeIdentifier}
          autoCapitalize="none"
          placeholder="Printed ID from the box QR"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={flowStyles.error}>{error}</Text> : null}
      </View>
    </ModalShell>
  );
}
