import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, type Child } from "@/contexts/AppContext";
import { TOKYO_DISTRICTS } from "@/constants/data";
import { DistrictPickerModal } from "@/components/DistrictPickerModal";

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  right,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon as any} size={16} color={colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
      {right && <View>{right}</View>}
      {onPress && !right && <Feather name="chevron-right" size={16} color={colors.border} />}
    </TouchableOpacity>
  );
}

function AddChildModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { nickname: string; age: number }) => void;
  initial?: Child;
}) {
  const colors = useColors();
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [age, setAge] = useState(initial?.age?.toString() ?? "");

  const save = () => {
    if (!nickname.trim() || !age) return;
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
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
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
            />
          </View>
          <View>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>年齢</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={age}
              onChangeText={setAge}
              placeholder="例：6"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
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

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    homeDistrict,
    extraDistrictIds,
    children,
    notifications,
    setHomeDistrict,
    addChild,
    removeChild,
    updateChild,
    addExtraDistrict,
    removeExtraDistrict,
    updateNotifications,
    resetApp,
  } = useApp();

  const handleReset = () => setShowResetConfirm(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [deleteTargetChild, setDeleteTargetChild] = useState<Child | null>(null);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"home" | "extra">("home");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>設定</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Children */}
        <SectionHeader title="お子さん" />
        <View style={[styles.sectionBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {children.map((child, i) => (
            <View
              key={child.id}
              style={[
                styles.childRow,
                i < children.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={[styles.childAvatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.childAvatarText, { color: colors.primary }]}>
                  {child.nickname[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.childName, { color: colors.foreground }]}>{child.nickname}</Text>
                <Text style={[styles.childAge, { color: colors.mutedForeground }]}>{child.age}歳</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingChild(child)} style={styles.iconBtn}>
                <Feather name="edit-2" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDeleteTargetChild(child)}
                style={styles.iconBtn}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addRow, children.length > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            onPress={() => setShowAddChild(true)}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[styles.addText, { color: colors.primary }]}>お子さんを追加</Text>
          </TouchableOpacity>
        </View>

        {/* Area */}
        <SectionHeader title="エリア" />
        <View style={[styles.sectionBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="home"
            label="居住区"
            value={homeDistrict?.name ?? "未設定"}
            onPress={() => {
              setPickerTarget("home");
              setShowDistrictPicker(true);
            }}
          />
          {extraDistrictIds.map((id, i) => {
            const d = TOKYO_DISTRICTS.find((x) => x.id === id);
            return (
              <View
                key={id}
                style={[
                  styles.settingsRow,
                  { backgroundColor: colors.card, borderColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="map-pin" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>{d?.name ?? id}</Text>
                <TouchableOpacity onPress={() => removeExtraDistrict(id)}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            );
          })}
          <TouchableOpacity
            style={[styles.addRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            onPress={() => {
              setPickerTarget("extra");
              setShowDistrictPicker(true);
            }}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[styles.addText, { color: colors.primary }]}>エリアを追加（勤務先など）</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <SectionHeader title="通知" />
        <View style={[styles.sectionBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="bell"
            label="Push通知"
            right={
              <Switch
                value={notifications.enabled}
                onValueChange={(v) => updateNotifications({ enabled: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            }
          />
          {notifications.enabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="alert-triangle" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>アラートレベル</Text>
                <View style={styles.levelPicker}>
                  {([2, 3] as const).map((lv) => (
                    <TouchableOpacity
                      key={lv}
                      style={[
                        styles.levelChip,
                        {
                          backgroundColor:
                            notifications.alertLevel === lv ? colors.primary : colors.muted,
                        },
                      ]}
                      onPress={() => updateNotifications({ alertLevel: lv })}
                    >
                      <Text
                        style={[
                          styles.levelChipText,
                          { color: notifications.alertLevel === lv ? "#fff" : colors.mutedForeground },
                        ]}
                      >
                        {lv === 2 ? "警戒以上" : "流行のみ"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="calendar" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>週次サマリー</Text>
                <View style={styles.dayPicker}>
                  {WEEKDAYS.map((day, i) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor:
                            notifications.weeklyDay === i ? colors.primary : colors.muted,
                        },
                      ]}
                      onPress={() => updateNotifications({ weeklyDay: i })}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          { color: notifications.weeklyDay === i ? "#fff" : colors.mutedForeground },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* Account */}
        <SectionHeader title="アカウント（任意）" />
        <View style={[styles.sectionBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="user"
            label="登録して設定を引き継ぐ"
            onPress={() => {}}
          />
        </View>

        {/* Reset */}
        <SectionHeader title="データ管理" />
        <View style={[styles.sectionBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.resetRow} onPress={handleReset}>
            <View style={[styles.rowIcon, { backgroundColor: "#fff0f0" }]}>
              <Feather name="refresh-ccw" size={16} color={colors.destructive} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.destructive }]}>初期化してやりなおす</Text>
            <Feather name="chevron-right" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          がっきゅうアラート v1.0.0
        </Text>
      </ScrollView>

      <AddChildModal
        visible={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSave={addChild}
      />
      {editingChild && (
        <AddChildModal
          visible={!!editingChild}
          onClose={() => setEditingChild(null)}
          initial={editingChild}
          onSave={(data) => updateChild(editingChild.id, data)}
        />
      )}

      {/* Delete Child Confirmation Modal */}
      <Modal
        visible={deleteTargetChild !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteTargetChild(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: "#fff0f0" }]}>
              <Feather name="user-x" size={24} color={colors.destructive} />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>
              {deleteTargetChild?.nickname}を削除しますか？
            </Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
              この操作は元に戻せません。登録情報がすべて削除されます。
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmCancel, { backgroundColor: colors.muted }]}
                onPress={() => setDeleteTargetChild(null)}
              >
                <Text style={[styles.confirmCancelText, { color: colors.foreground }]}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, { backgroundColor: colors.destructive }]}
                onPress={() => {
                  if (deleteTargetChild) {
                    removeChild(deleteTargetChild.id);
                    setDeleteTargetChild(null);
                  }
                }}
              >
                <Text style={styles.confirmDeleteText}>削除する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={showResetConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowResetConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: "#fff0f0" }]}>
              <Feather name="refresh-ccw" size={24} color={colors.destructive} />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>初期化の確認</Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
              すべての設定とお子さんの情報を削除し、最初から設定しなおします。この操作は元に戻せません。
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmCancel, { backgroundColor: colors.muted }]}
                onPress={() => setShowResetConfirm(false)}
              >
                <Text style={[styles.confirmCancelText, { color: colors.foreground }]}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, { backgroundColor: colors.destructive }]}
                onPress={() => {
                  setShowResetConfirm(false);
                  resetApp();
                  router.replace("/onboarding");
                }}
              >
                <Text style={styles.confirmDeleteText}>リセットする</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* District Picker Modal */}
      <DistrictPickerModal
        visible={showDistrictPicker}
        title={pickerTarget === "home" ? "居住エリアを選択" : "エリアを追加"}
        selectedId={pickerTarget === "home" ? homeDistrict?.id : undefined}
        onClose={() => setShowDistrictPicker(false)}
        onSelect={(d) => {
          if (pickerTarget === "home") {
            setHomeDistrict(d.id);
          } else {
            addExtraDistrict(d.id);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  content: {
    padding: 16,
    gap: 6,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
    marginLeft: 4,
  },
  sectionBlock: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 14,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  childAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  childAvatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  childName: {
    fontSize: 15,
    fontWeight: "600",
  },
  childAge: {
    fontSize: 12,
  },
  iconBtn: {
    padding: 6,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  addText: {
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  levelPicker: {
    flexDirection: "row",
    gap: 6,
  },
  levelChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  levelChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dayPicker: {
    flexDirection: "row",
    gap: 4,
  },
  dayChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  resetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmBox: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmBody: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    width: "100%",
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
  confirmDelete: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
  },
});
