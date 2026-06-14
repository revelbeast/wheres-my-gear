from pathlib import Path

path = Path("app/(tabs)/checklists/[checklistId].tsx")
text = path.read_text()

old = """  const packedItems = useMemo(() => {
    const base = sortedItems.filter((item) => !!item.packed);
    if (filter === "unpacked") return [];
    return base;
  }, [sortedItems, filter]);

  const headerRight = ("""

new = """  const packedItems = useMemo(() => {
    const base = sortedItems.filter((item) => !!item.packed);
    if (filter === "unpacked") return [];
    return base;
  }, [sortedItems, filter]);

  const totalItems = items.length;
  const packedItemCount = items.filter((item) => !!item.packed).length;
  const progressPercent = Math.round(
    (packedItemCount / Math.max(totalItems, 1)) * 100
  );

  const headerRight = ("""

if old not in text:
    raise SystemExit("Could not find packedItems block")

text = text.replace(old, new, 1)

old = """            <FrostedCard style={styles.categoryCard}>
              <Text
                style={[
                  styles.categoryLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Category
              </Text>
              <Text style={[styles.categoryValue, { color: theme.colors.text }]}>
                {getCategoryLabel(
                  checklist.category,
                  checklist.customCategoryLabel
                )}
              </Text>
            </FrostedCard>"""

new = """            <FrostedCard style={styles.categoryCard}>
              <Text
                style={[
                  styles.categoryLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Category
              </Text>
              <Text style={[styles.categoryValue, { color: theme.colors.text }]}>
                {getCategoryLabel(
                  checklist.category,
                  checklist.customCategoryLabel
                )}
              </Text>

              <View style={styles.progressSummaryWrap}>
                <Text
                  style={[
                    styles.progressSummaryText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {packedItemCount} of {totalItems} packed
                </Text>

                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>

                <Text
                  style={[
                    styles.progressPercentText,
                    { color: theme.colors.text },
                  ]}
                >
                  {progressPercent}%
                </Text>
              </View>
            </FrostedCard>"""

if old not in text:
    raise SystemExit("Could not find category card")

text = text.replace(old, new, 1)

anchor = """  categoryValue: {
    fontSize: 16,
    fontWeight: "700",
  },

  filterRow: {"""

insert = """  categoryValue: {
    fontSize: 16,
    fontWeight: "700",
  },

  progressSummaryWrap: {
    marginTop: 12,
  },

  progressSummaryText: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },

  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.28)",
    overflow: "hidden",
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgb(34,197,94)",
  },

  progressPercentText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "800",
  },

  filterRow: {"""

if anchor not in text:
    raise SystemExit("Could not find style anchor")

text = text.replace(anchor, insert, 1)

path.write_text(text)
print("Checklist detail progress bar added")
