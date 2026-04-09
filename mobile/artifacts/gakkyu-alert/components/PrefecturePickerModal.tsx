import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { PREFECTURES, type Prefecture } from "@/constants/data";

const PREF_GROUPS = [
  { title: "北海道・東北", ids: ["hokkaido","aomori","iwate","miyagi","akita","yamagata","fukushima"] },
  { title: "関東",         ids: ["ibaraki","tochigi","gunma","saitama","chiba","tokyo","kanagawa"] },
  { title: "中部",         ids: ["niigata","toyama","ishikawa","fukui","yamanashi","nagano","gifu","shizuoka","aichi"] },
  { title: "近畿",         ids: ["mie","shiga","kyoto","osaka","hyogo","nara","wakayama"] },
  { title: "中国",         ids: ["tottori","shimane","okayama","hiroshima","yamaguchi"] },
  { title: "四国",         ids: ["tokushima","kagawa","ehime","kochi"] },
  { title: "九州・沖縄",   ids: ["fukuoka","saga","nagasaki","kumamoto","oita","miyazaki","kagoshima","okinawa"] },
];

interface Props {
  visible: boolean;
  title: string;
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (prefecture: Prefecture) => void;
}

export function PrefecturePickerModal({ visible, title, selectedId, onClose, onSelect }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const groups = PREF_GROUPS.map((g) => ({
    title: g.title,
    data: g.ids
      .map((id) => PREFECTURES.find((p) => p.id === id))
      .filter((p): p is Prefecture => !!p)
      .filter((p) => !search || p.name.includes(search)),
  })).filter((g) => g.data.length > 0);

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
          <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="都道府県を検索"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.title}>
              <Text style={[styles.groupHeader, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>
                {group.title}
              </Text>
              {group.data.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.row,
                    { backgroundColor: colors.card },
                    i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                    selectedId === p.id && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => { onSelect(p); handleClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.prefName, { color: selectedId === p.id ? colors.primary : colors.foreground }]}>
                    {p.name}
                  </Text>
                  {selectedId === p.id && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  groupHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: "space-between",
  },
  prefName: { fontSize: 15, fontWeight: "500" },
});
