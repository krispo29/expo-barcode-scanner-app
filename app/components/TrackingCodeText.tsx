import React from "react";
import { Platform, StyleSheet, Text, TextStyle } from "react-native";

type TrackingCodeTextProps = {
  code: string;
  style?: TextStyle;
  highlightStyle?: TextStyle;
  highlightCount?: number;
};

/**
 * Renders tracking code with the last N characters highlighted.
 * Warehouse operators identify packages by the trailing digits on shipping labels.
 */
export function TrackingCodeText({
  code,
  style,
  highlightStyle,
  highlightCount = 5,
}: TrackingCodeTextProps) {
  if (!code) return null;

  const len = code.length;
  if (len <= highlightCount) {
    return (
      <Text style={[styles.baseText, styles.highlightText, style, highlightStyle]}>
        {code}
      </Text>
    );
  }

  const prefix = code.slice(0, len - highlightCount);
  const suffix = code.slice(len - highlightCount);

  return (
    <Text style={[styles.baseText, style]}>
      {prefix}
      <Text style={[styles.highlightText, highlightStyle]}>{suffix}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  baseText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 16,
    color: "#374151",
    letterSpacing: 0.5,
  },
  highlightText: {
    fontWeight: "800",
    color: "#D97706",
  },
});
