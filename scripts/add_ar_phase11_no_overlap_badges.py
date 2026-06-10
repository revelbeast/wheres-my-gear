from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# 1. Rename title
content = content.replace(
  'Nearby Labels ({arLabels.length})',
  'Labels In View ({arLabels.length})'
)

# 2. Add selected checkmark and status badge
content = content.replace(
'''                      <Text style={styles.nearbyLabelName} numberOfLines={1}>
                        {label.suggestedName || "Compartment"}
                      </Text>
                      <Text style={styles.nearbyLabelMeta}>
                        {(label.itemCount ?? 0)} items · {notPacked === 0 ? "All Present" : `${notPacked} not packed`}
                      </Text>''',
'''                      <Text style={styles.nearbyLabelName} numberOfLines={1}>
                        {isSelected ? "✓ " : ""}{label.suggestedName || "Compartment"}
                      </Text>
                      <Text style={styles.nearbyLabelMeta}>
                        {(label.itemCount ?? 0)} items
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.nearbyStatusBadge,
                        notPacked === 0 ? styles.nearbyStatusGood : styles.nearbyStatusWarn,
                      ]}
                    >
                      <Text style={styles.nearbyStatusText}>
                        {notPacked === 0 ? "All Present" : `${notPacked} Missing`}
                      </Text>'''
)

# 3. Close added badge view before chevron
content = content.replace(
'''                    </View>

                    <Text style={styles.nearbyLabelChevron}>›</Text>''',
'''                    </View>

                    <Text style={styles.nearbyLabelChevron}>›</Text>''',
1
)

# 4. Dynamic non-overlap position for detail card
content = content.replace(
'''          <View style={styles.arCard}>''',
'''          <View
            style={[
              styles.arCard,
              arLabels.length > 1
                ? { top: 128 + arLabels.length * 82 }
                : null,
            ]}
          >'''
)

# 5. Limit top items to cleaner preview
content = content.replace(
'''                    {arOverlay.topItems.join(", ")}''',
'''                    {arOverlay.topItems.slice(0, 3).join(", ")}
                    {arOverlay.topItems.length > 3 ? ` +${arOverlay.topItems.length - 3} more` : ""}'''
)

# 6. Add styles
content = content.replace(
'''  nearbyLabelChevron: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 28,
    opacity: 0.85,
  },''',
'''  nearbyStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  nearbyStatusGood: {
    backgroundColor: "rgba(34, 197, 94, 0.20)",
  },
  nearbyStatusWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.22)",
  },
  nearbyStatusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  nearbyLabelChevron: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 28,
    opacity: 0.85,
  },'''
)

# 7. Make panel/card slightly less transparent for readability
content = content.replace(
'backgroundColor: "rgba(15, 23, 42, 0.78)",',
'backgroundColor: "rgba(15, 23, 42, 0.84)",'
)
content = content.replace(
'backgroundColor: "rgba(15, 23, 42, 0.86)",',
'backgroundColor: "rgba(15, 23, 42, 0.88)",'
)

FILE.write_text(content)
print("AR Phase 11 no-overlap badges polish applied")
