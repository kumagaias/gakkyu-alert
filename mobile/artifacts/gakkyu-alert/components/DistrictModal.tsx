import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { type District, type EpidemicLevel, LEVEL_NAMES } from "@/constants/data";
import { DistrictInfoPanel } from "@/components/DistrictInfoPanel";

interface Props {
  district: District | null;
  onClose: () => void;
}

export function DistrictModal({ district, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!district) return null;

  const levelColors: Record<EpidemicLevel, string> = {
    0: colors.level0,
    1: colors.level1,
    2: colors.level2,
    3: colors.level3,
  };
  const levelBg: Record<EpidemicLevel, string> = {
    0: colors.level0Bg,
    1: colors.level1Bg,
    2: colors.level2Bg,
    3: colors.level3Bg,
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.districtName, { color: colors.foreground }]}>{district.name}</Text>
            <View
              style={[
                styles.levelBadge,
                {
                  backgroundColor: levelBg[district.level],
                  borderColor: levelColors[district.level],
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: levelColors[district.level] }]} />
              <Text style={[styles.levelLabel, { color: levelColors[district.level] }]}>
                Lv.{district.level} {LEVEL_NAMES[district.level]}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.muted }]}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Shared content panel */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <DistrictInfoPanel district={district} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  districtName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  content: {
    padding: 20,
    gap: 12,
  },
});
