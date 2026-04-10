import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.body, { color: colors.mutedForeground }]}>{children}</Text>
  );
}

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>プライバシーポリシー</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.updated, { color: colors.mutedForeground }]}>最終更新日：2025年4月</Text>

        <Body>
          がっきゅうアラート（以下「本アプリ」）は、利用者のプライバシーを尊重し、個人情報の保護に努めます。本ポリシーは、本アプリが収集する情報およびその利用方法について説明します。
        </Body>

        <Section title="1. 収集する情報">
          <Body>
            本アプリは以下の情報を収集・利用します。{"\n\n"}
            <Text style={styles.bold}>■ デバイストークン（Push通知用）{"\n"}</Text>
            Push通知を有効にした場合、端末固有の通知トークンをサーバーに送信・保存します。通知の送信にのみ使用します。{"\n\n"}
            <Text style={styles.bold}>■ 居住地（都道府県・区市レベル）{"\n"}</Text>
            学級閉鎖アラートを届けるため、設定された居住エリア情報をサーバーに送信・保存します。{"\n\n"}
            <Text style={styles.bold}>■ お子さんの情報{"\n"}</Text>
            ニックネームと年齢は端末内にのみ保存され、サーバーには送信されません。{"\n\n"}
            <Text style={styles.bold}>■ 利用状況{"\n"}</Text>
            アプリの安定性向上のため、クラッシュレポートや匿名の利用統計を収集する場合があります。
          </Body>
        </Section>

        <Section title="2. 情報の利用目的">
          <Body>
            収集した情報は以下の目的にのみ使用します。{"\n\n"}
            • 学級閉鎖・感染症アラートのPush通知送信{"\n"}
            • 居住エリアに応じた情報のフィルタリング{"\n"}
            • アプリの不具合修正・品質改善
          </Body>
        </Section>

        <Section title="3. 第三者への提供">
          <Body>
            本アプリは、以下の場合を除き、収集した情報を第三者に提供・販売しません。{"\n\n"}
            • Push通知の配信に必要な範囲でApple（APNs）またはGoogle（FCM）へ通知トークンを提供する場合{"\n"}
            • 法令に基づき開示が必要な場合
          </Body>
        </Section>

        <Section title="4. データの保管と削除">
          <Body>
            デバイストークンおよび居住エリア情報は、本アプリをアンインストールするか、設定画面から「初期化してやりなおす」を実行することで削除されます。削除後はPush通知が届かなくなります。
          </Body>
        </Section>

        <Section title="5. セキュリティ">
          <Body>
            収集した情報はAWS上で管理し、適切なアクセス制御・暗号化を適用しています。ただし、インターネット通信の性質上、完全なセキュリティを保証することはできません。
          </Body>
        </Section>

        <Section title="6. ポリシーの変更">
          <Body>
            本ポリシーは予告なく変更される場合があります。重要な変更がある場合はアプリ内でお知らせします。変更後も本アプリを継続利用された場合、変更に同意したものとみなします。
          </Body>
        </Section>

        <Section title="7. お問い合わせ">
          <Body>
            本ポリシーに関するご質問は、アプリのサポートページよりお問い合わせください。
          </Body>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  content: {
    padding: 20,
    gap: 4,
  },
  updated: {
    fontSize: 12,
    marginBottom: 16,
  },
  section: {
    marginTop: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
  },
});
