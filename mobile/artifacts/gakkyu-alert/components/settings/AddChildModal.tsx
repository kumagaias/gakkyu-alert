import React, { useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Child } from "@/contexts/AppContext";

interface AddChildModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { nickname: string; age: number }) => void;
  initial?: Child;
}

export function AddChildModal({ visible, onClose, onSave, initial }: AddChildModalProps) {
  const colors = useColors();
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [age, setAge] = useState(initial?.age?.toString() ?? "");
  const ageInputRef = useRef<TextInput>(null);

  const save = () => {
    if (!nickname.trim() || !age) return;
    Keyboard.dismiss();
    onSave({ nickname: nickname.trim(), age: parseInt(age) });
    setNickname("");
    setAge("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {initial ? "お子さんを編集" : "お子さんを追加"}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.muted }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalContent}>
          <View>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>ニックネーム</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={nickname}
              onChangeText={setNickname}
              placeholder="例：たろう"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              onSubmitEditing={() => ageInputRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
          <View>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>年齢</Text>
            <TextInput
              ref={ageInputRef}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={age}
              onChangeText={setAge}
              placeholder="例：6"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={save}
            />
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: nickname.trim() && age ? colors.primary : colors.muted }]}
            onPress={save}
            disabled={!nickname.trim() || !age}
          >
            <Text style={[styles.saveBtnText, { color: nickname.trim() && age ? "#fff" : colors.mutedForeground }]}>
              保存する
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: 16,
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveBtn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
