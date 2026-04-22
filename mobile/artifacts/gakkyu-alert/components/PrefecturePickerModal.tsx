import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
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
import { resolvePrefectureByGps, resolvePrefectureByZip } from "@/utils/location";

const PREF_GROUPS = [
  { title: "北海道・東北", ids: ["hokkaido","aomori","iwate","miyagi","akita","yamagata","fukushima"] },
  { title: "関東",         ids: ["ibaraki","tochigi","gunma","saitama","chiba","tokyo","kanagawa"] },
  { title: "中部",         ids: ["niigata","toyama","ishikawa","fukui","yamanashi","nagano","gifu","shizuoka","aichi"] },
  { title: "近畿",         ids: ["mie","shiga","kyoto","osaka","hyogo","nara","wakayama"] },
  { title: "中国",         ids: ["tottori","shimane","okayama","hiroshima","yamaguchi"] },
  { title: "四国",         ids: ["tokushima","kagawa","ehime","kochi"] },
  { title: "九州・沖縄",   ids: ["fukuoka","saga","nagasaki","kumamoto","oita","miyazaki","kagoshima","okinawa"] },
];

const GPS_ERRORS: Record<string, string> = {
  permission_denied: "位置情報の許可が必要です",
  not_found:         "現在地から都道府県を特定できませんでした",
  error:             "位置情報の取得に失敗しました",
};

const ZIP_ERRORS: Record<string, string> = {
  invalid_format: "7桁の数字で入力してください",
  not_found:      "郵便番号が見つかりませんでした",
  error:          "通信エラーが発生しました",
};

interface Props {
  visible: boolean;
  title: string;
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (prefecture: Prefecture) => void;
  startWithList?: boolean;
}

export function PrefecturePickerModal({ visible, title, selectedId, onClose, onSelect, startWithList }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [showList, setShowList]     = useState(startWithList ?? false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError]     = useState<string | null>(null);
  const [zipCode, setZipCode]       = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError]     = useState<string | null>(null);
  const [resolved, setResolved]     = useState<Prefecture | null>(null);

  // GPS pulse animation
  const gpsPulseScale   = useRef(new Animated.Value(1)).current;
  const gpsPulseOpacity = useRef(new Animated.Value(0)).current;
  const gpsPulseAnim    = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (gpsLoading) {
      gpsPulseOpacity.setValue(0.5);
      gpsPulseScale.setValue(1);
      gpsPulseAnim.current = Animated.loop(
        Animated.parallel([
          Animated.timing(gpsPulseScale, { toValue: 1.8, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: false }),
          Animated.timing(gpsPulseOpacity, { toValue: 0, duration: 1000, useNativeDriver: false }),
        ])
      );
      gpsPulseAnim.current.start();
    } else {
      gpsPulseAnim.current?.stop();
      gpsPulseScale.setValue(1);
      gpsPulseOpacity.setValue(0);
    }
  }, [gpsLoading]);

  useEffect(() => {
    if (!visible) {
      setShowList(startWithList ?? false);
      setGpsError(null);
      setZipCode("");
      setZipError(null);
      setResolved(null);
    }
  }, [visible, startWithList]);

  const handleGps = async () => {
    setGpsLoading(true);
    setGpsError(null);
    setResolved(null);
    const result = await resolvePrefectureByGps();
    setGpsLoading(false);
    if (result.type === "success") {
      setResolved(result.prefecture);
    } else {
      setGpsError(GPS_ERRORS[result.type] ?? "エラーが発生しました");
    }
  };

  const handleZip = async () => {
    setZipLoading(true);
    setZipError(null);
    setResolved(null);
    const result = await resolvePrefectureByZip(zipCode);
    setZipLoading(false);
    if (result.type === "success") {
      setResolved(result.prefecture);
    } else {
      setZipError(ZIP_ERRORS[result.type] ?? "エラーが発生しました");
    }
  };

  const handleConfirm = () => {
    if (!resolved) return;
    onSelect(resolved);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const groups = PREF_GROUPS.map((g) => ({
    title: g.title,
    data: g.ids.map((id) => PREFECTURES.find((p) => p.id === id)).filter((p): p is Prefecture => !!p),
  }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.outer, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {showList && (
            <TouchableOpacity onPress={() => setShowList(false)} style={[styles.iconBtn, { backgroundColor: colors.muted }]}>
              <Feather name="arrow-left" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {showList ? "一覧から選択" : title}
          </Text>
          <TouchableOpacity onPress={handleClose} style={[styles.iconBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {showList ? (
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {groups.map((group) => (
              <View key={group.title}>
                <Text style={[styles.groupHeader, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>
                  {group.title}
                </Text>
                {group.data.map((p, i) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.listRow,
                      { backgroundColor: colors.card },
                      i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                      selectedId === p.id && { backgroundColor: colors.accent },
                    ]}
                    onPress={() => { onSelect(p); handleClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.listRowText, { color: selectedId === p.id ? colors.primary : colors.foreground }]}>
                      {p.name}
                    </Text>
                    {selectedId === p.id && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.searchArea, { paddingBottom: insets.bottom + 20 }]}>
            {/* GPS */}
            <View style={styles.gpsBtnWrap}>
              <Animated.View
                style={[styles.gpsPulseRing, { backgroundColor: colors.primary, transform: [{ scale: gpsPulseScale }], opacity: gpsPulseOpacity }]}
                pointerEvents="none"
              />
              <TouchableOpacity
                style={[styles.gpsBtn, { backgroundColor: colors.primary }]}
                onPress={handleGps}
                disabled={gpsLoading}
                activeOpacity={0.85}
              >
                {gpsLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="navigation" size={15} color="#fff" />}
                <Text style={styles.gpsBtnText}>
                  {gpsLoading ? "現在地を取得中..." : "現在地から自動取得"}
                </Text>
              </TouchableOpacity>
            </View>
            {gpsError && <Text style={[styles.errorText, { color: colors.destructive }]}>{gpsError}</Text>}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerLabel, { color: colors.mutedForeground }]}>または郵便番号</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Postal code */}
            <View style={styles.zipRow}>
              <View style={[styles.zipWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.zipMark, { color: colors.mutedForeground }]}>〒</Text>
                <TextInput
                  style={[styles.zipInput, { color: colors.foreground }]}
                  placeholder="郵便番号（例：1000001）"
                  placeholderTextColor={colors.mutedForeground}
                  value={zipCode}
                  onChangeText={(t) => { setZipCode(t); setZipError(null); setResolved(null); }}
                  keyboardType="number-pad"
                  maxLength={8}
                  onSubmitEditing={handleZip}
                  returnKeyType="search"
                />
                {zipCode.length > 0 && (
                  <TouchableOpacity onPress={() => { setZipCode(""); setZipError(null); setResolved(null); }}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.zipBtn, { backgroundColor: colors.primary, opacity: zipLoading || zipCode.replace(/\D/g, "").length !== 7 ? 0.45 : 1 }]}
                onPress={handleZip}
                disabled={zipLoading || zipCode.replace(/\D/g, "").length !== 7}
              >
                {zipLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.zipBtnText}>検索</Text>}
              </TouchableOpacity>
            </View>
            {zipError && <Text style={[styles.errorText, { color: colors.destructive }]}>{zipError}</Text>}

            {/* Resolved confirm */}
            {resolved && (
              <View style={styles.resolvedArea}>
                <View style={[styles.resolvedCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                  <Feather name="map-pin" size={16} color={colors.primary} />
                  <Text style={[styles.resolvedLabel, { color: colors.primary }]}>{resolved.name}が見つかりました</Text>
                </View>
                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={handleConfirm} activeOpacity={0.85}>
                  <Text style={styles.confirmBtnText}>{resolved.name}で登録する</Text>
                  <Feather name="check" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setResolved(null)} activeOpacity={0.7}>
                  <Text style={[styles.retryLink, { color: colors.mutedForeground }]}>やりなおす</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Manual list link */}
            {!resolved && (
              <TouchableOpacity style={styles.manualLink} onPress={() => setShowList(true)} activeOpacity={0.7}>
                <Feather name="list" size={14} color={colors.mutedForeground} />
                <Text style={[styles.manualLinkText, { color: colors.mutedForeground }]}>一覧から手動で選択</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    ...(Platform.OS === "web" && {
      alignItems: "center" as const,
    }),
  },
  container: {
    flex: 1,
    paddingTop: 8,
    ...(Platform.OS === "web" && {
      maxWidth: 680,
      width: "100%",
    }),
  },
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
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  searchArea: { padding: 20, gap: 12 },
  gpsBtnWrap: { position: "relative" },
  gpsPulseRing: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12 },
  gpsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  gpsBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel: { fontSize: 11, fontWeight: "500" },
  zipRow: { flexDirection: "row", gap: 8 },
  zipWrap: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, gap: 8 },
  zipMark: { fontSize: 14, fontWeight: "600" },
  zipInput: { flex: 1, fontSize: 14, padding: 0 },
  zipBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center", minWidth: 56 },
  zipBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  errorText: { fontSize: 12, marginTop: -4 },
  resolvedArea: { gap: 10, marginTop: 4 },
  resolvedCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  resolvedLabel: { fontSize: 15, fontWeight: "600" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  retryLink: { textAlign: "center", fontSize: 13, textDecorationLine: "underline" },
  manualLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, paddingVertical: 8 },
  manualLinkText: { fontSize: 13, fontWeight: "500" },
  groupHeader: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 16, paddingVertical: 8 },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, justifyContent: "space-between" },
  listRowText: { fontSize: 15, fontWeight: "500" },
});
