from pathlib import Path

path = Path("app/(tabs)/checklists/index.tsx")
text = path.read_text()

old = '''                              <View style={styles.progressRow}>
                                <ThemedText
                                  color="secondary"
                                  style={[
                                    styles.meta,
                                    selectedChecklistStatus === "packed" &&
                                    styles.packedProgressText,
                                  ]}
                                >
                                  {checklist.packedCount ?? 0} / {checklist.totalCount ?? 0} packed
                                </ThemedText>

                                {(checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0 ? (
                                  <ThemedText style={styles.packedBadge}>
                                    Packed
                                  </ThemedText>
                                ) : (
                                  <ThemedText color="danger" style={styles.toPackBadge}>
                                    {checklist.missingCount ?? 0} to pack
                                  </ThemedText>
                                )}
                              </View>'''

new = '''                              <View style={styles.progressRow}>
                                <ThemedText
                                  color="secondary"
                                  style={[
                                    styles.meta,
                                    selectedChecklistStatus === "packed" &&
                                    styles.packedProgressText,
                                  ]}
                                >
                                  {checklist.packedCount ?? 0} of {checklist.totalCount ?? 0} packed
                                </ThemedText>

                                {(checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0 ? (
                                  <ThemedText style={styles.packedBadge}>
                                    Packed
                                  </ThemedText>
                                ) : (
                                  <ThemedText color="danger" style={styles.toPackBadge}>
                                    {checklist.missingCount ?? 0} to pack
                                  </ThemedText>
                                )}
                              </View>

                              <View style={styles.progressBarTrack}>
                                <View
                                  style={[
                                    styles.progressBarFill,
                                    {
                                      width: `${Math.round(
                                        ((checklist.packedCount ?? 0) /
                                          Math.max(checklist.totalCount ?? 0, 1)) *
                                          100
                                      )}%`,
                                    },
                                  ]}
                                />
                              </View>

                              <ThemedText color="secondary" style={styles.progressPercentText}>
                                {Math.round(
                                  ((checklist.packedCount ?? 0) /
                                    Math.max(checklist.totalCount ?? 0, 1)) *
                                    100
                                )}
                                %
                              </ThemedText>'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected first checklist card block once, found {count}")

text = text.replace(old, new, 1)

old2 = '''                          <View style={styles.progressRow}>
                            <ThemedText
                              color="secondary"
                              style={[
                                styles.meta,
                                selectedChecklistStatus === "packed" &&
                                styles.packedProgressText,
                              ]}
                            >
                              {checklist.packedCount ?? 0} / {checklist.totalCount ?? 0} packed
                            </ThemedText>

                            {(checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0 ? (
                              <ThemedText style={styles.packedBadge}>
                                Packed
                              </ThemedText>
                            ) : (
                              <ThemedText color="danger" style={styles.toPackBadge}>
                                {checklist.missingCount ?? 0} to pack
                              </ThemedText>
                            )}
                          </View>'''

new2 = '''                          <View style={styles.progressRow}>
                            <ThemedText
                              color="secondary"
                              style={[
                                styles.meta,
                                selectedChecklistStatus === "packed" &&
                                styles.packedProgressText,
                              ]}
                            >
                              {checklist.packedCount ?? 0} of {checklist.totalCount ?? 0} packed
                            </ThemedText>

                            {(checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0 ? (
                              <ThemedText style={styles.packedBadge}>
                                Packed
                              </ThemedText>
                            ) : (
                              <ThemedText color="danger" style={styles.toPackBadge}>
                                {checklist.missingCount ?? 0} to pack
                              </ThemedText>
                            )}
                          </View>

                          <View style={styles.progressBarTrack}>
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${Math.round(
                                    ((checklist.packedCount ?? 0) /
                                      Math.max(checklist.totalCount ?? 0, 1)) *
                                      100
                                  )}%`,
                                },
                              ]}
                            />
                          </View>

                          <ThemedText color="secondary" style={styles.progressPercentText}>
                            {Math.round(
                              ((checklist.packedCount ?? 0) /
                                Math.max(checklist.totalCount ?? 0, 1)) *
                                100
                            )}
                            %
                          </ThemedText>'''

count2 = text.count(old2)
if count2 != 1:
    raise SystemExit(f"Expected second checklist card block once, found {count2}")

text = text.replace(old2, new2, 1)

style_anchor = '''  meta: {},

  toPackBadge: {'''

style_insert = '''  meta: {},

  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.28)",
    overflow: "hidden",
    marginTop: 8,
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgb(34,197,94)",
  },

  progressPercentText: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },

  toPackBadge: {'''

if style_anchor not in text:
    raise SystemExit("Could not find style anchor for progress bar styles")

text = text.replace(style_anchor, style_insert, 1)

path.write_text(text)
print("Added checklist card progress bars to app/(tabs)/checklists/index.tsx")
