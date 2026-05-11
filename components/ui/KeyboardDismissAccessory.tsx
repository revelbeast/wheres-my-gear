import { ChevronDown } from "lucide-react-native";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import HapticPressable from "./HapticPressable";

type KeyboardDismissAccessoryProps = {
  nativeID: string;
};

export default function KeyboardDismissAccessory({
  nativeID,
}: KeyboardDismissAccessoryProps) {
  if (Platform.OS !== "ios") {
    return null;
  }

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.keyboardAccessory}>
        <HapticPressable
          onPress={Keyboard.dismiss}
          style={styles.keyboardDismissButton}
        >
          <ChevronDown size={22} color="#FFFFFF" />
        </HapticPressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  keyboardAccessory: {
    minHeight: 44,
    backgroundColor: "rgba(20,20,24,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  keyboardDismissButton: {
    width: 40,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
