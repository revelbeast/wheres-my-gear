from pathlib import Path

path = Path("app/(tabs)/faq.tsx")
text = path.read_text()

anchor = '''  {
    question: "What can I search for?",
'''

insert = '''  {
    question: "Do Upcoming Trips sync with my calendar?",
    answer:
      "Yes. When you create a trip, Where's My Gear can create an all-day calendar event on your device. If you update the trip name or date, the calendar event is updated automatically. If you delete the trip, the calendar event is removed as well. You may be prompted to grant calendar access the first time you create a trip.",
  },

'''

if anchor not in text:
    raise SystemExit("FAQ anchor not found")

text = text.replace(anchor, insert + anchor, 1)

path.write_text(text)
print("Added Upcoming Trips calendar FAQ")
