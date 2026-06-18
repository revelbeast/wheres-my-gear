from pathlib import Path

path = Path("app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx")
text = path.read_text()

old_title = '"Do you already own this item?"'
new_title = '"You already have this item in your inventory"'

if old_title not in text:
    raise SystemExit("Could not find duplicate alert title")

text = text.replace(old_title, new_title)

old_message = '''        `Possible duplicate found in your inventory:\\n\\n${duplicateText}\\n\\nAdd it anyway?`,
'''

new_message = '''        `${duplicateText}\\n\\nAdd it anyway?`,
'''

if old_message not in text:
    raise SystemExit("Could not find duplicate alert message")

text = text.replace(old_message, new_message)

path.write_text(text)
print("Updated duplicate item alert wording")
