from pathlib import Path
import re

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# 1. Remove debug overlay block
content = re.sub(
    r'\s*{\s*/\* DEBUG OVERLAY \*/\s*}\s*<View\s+style=\{\{\s*position: "absolute",\s*top: 60,.*?</View>\s*',
    "\n",
    content,
    flags=re.DOTALL,
)

# 2. Hide AI button while AR card is showing, so footer does not say Scanning...
content = content.replace(
'''        <HapticPressable
          style={[styles.closeButton, styles.aiButton]}
          onPress={handleAnalyzeImageWithAI}
          disabled={isScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? "Scanning..." : "Scan with AI"}
          </Text>
        </HapticPressable>''',
'''        {!arOverlay ? (
          <HapticPressable
            style={[styles.closeButton, styles.aiButton]}
            onPress={handleAnalyzeImageWithAI}
            disabled={isScanning}
          >
            <Text style={styles.buttonText}>
              {isScanning ? "Scanning..." : "Scan with AI"}
            </Text>
          </HapticPressable>
        ) : null}'''
)

# 3. Compact AR card styles
content = content.replace(
'''  arCard: {
    position: "absolute",
    top: 145,
    left: 20,
    right: 20,
    zIndex: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },''',
'''  arCard: {
    position: "absolute",
    top: 118,
    right: 16,
    width: 330,
    zIndex: 20,
    backgroundColor: "rgba(15, 23, 42, 0.86)",
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },'''
)

content = content.replace('''  arCardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12,
  },''',
'''  arCardTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
    paddingRight: 10,
  },'''
)

content = content.replace('''  arCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },''',
'''  arCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },'''
)

content = content.replace('''  arCardSubtitle: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
    marginBottom: 12,
  },''',
'''  arCardSubtitle: {
    color: "rgba(255,255,255,0.72)",
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
  },'''
)

content = content.replace('''  arStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },''',
'''  arStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },'''
)

content = content.replace('''  arStatBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },''',
'''  arStatBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: "center",
  },'''
)

content = content.replace('''  arStatNumber: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },''',
'''  arStatNumber: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },'''
)

content = content.replace('''  arTopItemsBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },''',
'''  arTopItemsBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
  },'''
)

content = content.replace('''  arPrimaryButton: {
    marginTop: 14,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },''',
'''  arPrimaryButton: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },'''
)

FILE.write_text(content)
print("AR Phase 3.5 visual cleanup applied")
