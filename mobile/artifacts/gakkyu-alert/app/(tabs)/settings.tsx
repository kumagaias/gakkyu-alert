import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useColors } from "@/hooks/useColors";
import { useApp, type Child } from "@/contexts/AppContext";
import { PREFECTURES } from "@/constants/data";
import { PrefecturePickerModal } from "@/components/PrefecturePickerModal";
import { LevelExplainModal } from "@/components/LevelExplainModal";
import { SectionHeader } from "@/components/settings/SectionHeader";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { AddChildModal } from "@/components/settings/AddChildModal";

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

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [deleteTargetChild, setDeleteTargetChild] = useState<Child | null>(null);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"home" | "extra">("home");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLevelExplain, setShowLevelExplain] = useState(false);

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
            const d = PREFECTURES.find((x) => x.id === id);
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
          {/* TODO: 複数エリア追加機能（勤務先など）— 将来実装
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
          */}
        </View>

        {/* Notifications — web では Push 非対応のため非表示 */}
        {Platform.OS !== "web" && <SectionHeader title="通知" />}
        {Platform.OS !== "web" && <View style={[styles.sectionBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="bell"
            label="Push通知"
            right={
              <Switch
                value={notifications.enabled}
                onValueChange={(v) => {
                  if (v) {
                    Alert.alert(
                      "Push通知を有効にする",
                      "学級閉鎖アラートをお届けするために、通知の許可が必要です。お住まいの地域の感染症情報をリアルタイムでお知らせします。\n\nデバイス識別子は通知配信のためのみ使用し、サーバーに送信されます。",
                      [
                        { text: "キャンセル", style: "cancel" },
                        { text: "許可する", onPress: () => updateNotifications({ enabled: true }) },
                      ]
                    );
                  } else {
                    updateNotifications({ enabled: false });
                  }
                }}
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
              <TouchableOpacity
                style={[styles.levelTip, { backgroundColor: colors.muted }]}
                onPress={() => setShowLevelExplain(true)}
                activeOpacity={0.7}
              >
                <Feather name="info" size={13} color={colors.primary} />
                <Text style={[styles.levelTipText, { color: colors.primary }]}>感染レベルとは？</Text>
              </TouchableOpacity>
            </>
          )}
        </View>}

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

        {/* About */}
        <SectionHeader title="アプリについて" />
        <View style={[styles.sectionBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="database"
            label="データソース"
            onPress={() => router.push("/data-sources" as Href)}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="shield"
            label="プライバシーポリシー"
            onPress={() => router.push("/privacy-policy" as Href)}
          />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          学級アラート v{Constants.expoConfig?.version ?? "1.0.0"}
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

      <LevelExplainModal visible={showLevelExplain} onClose={() => setShowLevelExplain(false)} />

      {/* Prefecture Picker Modal */}
      <PrefecturePickerModal
        visible={showDistrictPicker}
        title="居住都道府県を選択"
        selectedId={homeDistrict?.id}
        onClose={() => setShowDistrictPicker(false)}
        onSelect={(p) => setHomeDistrict(p.id)}
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
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
  levelTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  levelTipText: {
    fontSize: 13,
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
