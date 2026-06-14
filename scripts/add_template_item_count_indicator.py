from pathlib import Path

path = Path("app/(tabs)/checklists/templates.tsx")
text = path.read_text()

old = """                      <Text
                        style={[
                          styles.templateTitle,
                          { color: theme.colors.text },
                        ]}
                      >
                        {template.name}
                      </Text>

                      <View style={styles.templateLinks}>"""

new = """                      <Text
                        style={[
                          styles.templateTitle,
                          { color: theme.colors.text },
                        ]}
                      >
                        {template.name}
                      </Text>

                      <View style={styles.templateItemCountPill}>
                        <Text style={styles.templateItemCountText}>
                          {template.itemCount ?? 0} items
                        </Text>
                      </View>

                      <View style={styles.templateLinks}>"""

if old not in text:
    raise SystemExit("Could not find template title block")

text = text.replace(old, new, 1)

anchor = """  templateTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  templateLinks: {"""

insert = """  templateTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  templateItemCountPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },

  templateItemCountText: {
    color: "rgb(34,197,94)",
    fontSize: 12,
    fontWeight: "800",
  },

  templateLinks: {"""

if anchor not in text:
    raise SystemExit("Could not find template style anchor")

text = text.replace(anchor, insert, 1)

path.write_text(text)
print("Template item-count indicator added")
