import { Pressable, ScrollView, Text, View } from "react-native";
import CloseIcon from "../../../assets/svg/shared/close_icon.svg";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createModalShellStyles } from "./ModalShellStyles";

export default function ModalShell({
  visible,
  title,
  onClose,
  children,
  scrollable = true,
  footer,
}) {
  const styles = useThemedStyles(createModalShellStyles);
  const { colors } = useTheme();

  if (!visible) return null;

  const body = scrollable ? (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <View style={styles.overlayRoot}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <CloseIcon width={16} height={16} color={colors.icon} />
          </Pressable>
        </View>
        <View style={styles.body}>{body}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}
