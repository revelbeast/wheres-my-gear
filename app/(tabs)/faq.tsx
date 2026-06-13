import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FAQItem[] = [

  {
    question: "What is Where's My Gear?",
    answer:
      "Where's My Gear helps you track gear by storage space, room, compartment, item, and checklist so you know where items are located and what still needs to be packed.",
  },
  {
    question: "What is included with Premium +?",
    answer:
      "Premium + adds Gear Assistant, Scan w/AI, QR / Barcode Scanner access, Create QR Labels, and Archive access. Gear Assistant lets you quickly speak items into inventory and save them to a Storage Space or Compartment. Scan w/AI helps identify gear by taking a photo and using smart image recognition. QR / Barcode Scanner can scan Where's My Gear QR labels or product barcodes, then open the matching compartment or Scan Result screen. Archive lets you move inactive Storage Spaces, Compartments, Inventory Items, Checklists, Checklist Items, Checklist Templates, and saved notes out of your active workspace without permanently deleting them.",
  },
  {
    question: "What is Scan w/AI?",
    answer:
      "Scan w/AI uses your camera to capture a photo of your gear and suggest an item name using image recognition. It works best for tools, camping gear, tactical gear, electronics, storage items, and products without visible barcodes. After scanning, you can review the suggested item name, add details, choose a Storage Space or Compartment, and save the item to inventory.",
  },
  {
    question: "When should I use Scan w/AI vs QR / Barcode Scanner?",
    answer:
      "Use Scan w/AI when an item has no barcode, the label is worn, or you want to identify gear from a photo. Use QR / Barcode Scanner when a product has a visible UPC, barcode, or Where's My Gear QR label. Product barcodes open the Scan Result screen automatically when a match is found, while QR labels open the linked compartment.",
  },
  {
    question: "How do I use Create QR Labels?",
    answer:
      "Create QR Labels lets you generate a printable QR label for a compartment, box, bin, shelf, drawer, or storage area. After printing the label, attach it to the physical compartment. To view the contents later, open Where's My Gear, go to Dashboard, tap QR / Barcode Scanner, and scan the printed QR label inside the app. The app will open the matching compartment and show the items stored there. These labels are designed for the Where's My Gear QR / Barcode Scanner. Your phone's regular camera app may show No usable data found because the QR code contains app-specific information.",
  },
  {
    question: "What is Gear Assistant?",
    answer:
      "Gear Assistant is a Premium + feature that lets you speak items into inventory, review what was detected, choose the correct Storage Space or Compartment, and save the items without manually typing each one. On supported iOS devices, Gear Assistant can also be opened from Siri or Apple Shortcuts.",
  },
  {
    question: "How do I use Gear Assistant?",
    answer:
      "Open Gear Assistant from the Dashboard or use Siri on supported iOS devices. Tap the mic and say the items you want to add. For example, say: Add two headlamps, one first aid kit, and three batteries to garage box. After speaking, review the detected items, choose the save location, then save them to inventory.",
  },
  {
    question: "What Siri Shortcuts are available?",
    answer:
      "On supported iOS devices, Where's My Gear supports Siri and Apple Shortcuts for Open Dashboard, Add Gear, Search Gear, Find Gear, Open Scanner, Gear Assistant, Open Checklists, and Open Trips. Find Gear opens Inventory with your search already filled in. Open Scanner launches the QR / Barcode Scanner, and Gear Assistant opens the voice workflow.",
  },
  {
    question: "How is Add Gear different from Gear Assistant?",
    answer:
      "Add Gear is a quick Siri Shortcut and manual entry screen for adding one item fast. Gear Assistant is a Premium + voice workflow that can detect multiple spoken items and help save them to a selected Storage Space or Compartment.",
  },
  {
    question: "Does Where's My Gear work offline?",
    answer:
      "Yes. Where's My Gear supports offline use for many inventory workflows. You can view previously loaded Storage Spaces, Rooms, Compartments, Inventory Items, and Checklists while offline. You can also update item photos, packed status, and quantities offline. Changes sync when an internet connection becomes available.",
  },
  {
    question: "Can I add photos to items?",
    answer:
      "Yes. You can take a photo or choose one from your device library. Item photos help you identify gear faster.",
  },
  {
    question: "Can I save notes?",
    answer:
      "Yes. Notes are saved by Storage Space. Open Notes from the Dashboard to add storage-specific notes. Notes auto-save while you type and can also be saved manually.",
  },
  {
    question: "Does Where's My Gear use Apple sign-in?",
    answer:
      "Yes. The app uses Apple sign-in, so you do not need to create or manage a separate password inside the app.",
  },
  {
    question: "How do Checklists work?",
    answer:
      "Checklists help you plan what to pack. You can create a checklist, add items, assign checklist items to a storage space and compartment, and mark items as Packed or To Pack.",
  },
  {
    question: "How do I use Upcoming Trips?",
    answer:
      "Create a trip from the Dashboard, select your trip date, and add or link a checklist. As your trip approaches, you can track your progress using Packed and To Pack items.",
  },
  {
    question: "What are Upcoming Trips?",
    answer:
      "Upcoming Trips help you plan ahead by organizing your packing needs by date. You can create a trip, assign a date, and track what needs to be packed before you leave.",
  },
  {
    question: "What can I search for?",
    answer:
      "Dashboard search can find Items, Storage Spaces, Rooms, Compartments, Checklists, and Templates. You can search by names, storage types, packed status, or To Pack status.",
  },
  {
    question: "What does Packed mean?",
    answer:
      "Packed means the item is currently accounted for and ready. Packed items increase the Items Packed count on the Dashboard for the selected Storage Space.",
  },
  {
    question: "What does To Pack mean?",
    answer:
      "To Pack means the item still needs to be packed or accounted for. These items increase the To Pack count on the Dashboard for the selected Storage Space.",
  },
  {
    question: "What happens if I delete all data?",
    answer:
      "Delete All Data permanently removes all app data, including active and archived Storage Spaces, Compartments, Inventory Items, Checklists, Checklist Items, Checklist Templates, and saved notes. This action cannot be undone.",
  },
  {
    question: "How is gear organized?",
    answer:
      "Where's My Gear uses a simple hierarchy: Storage Space, Room, Compartment, then Item. A Storage Space is the larger location, such as a van, RV, garage, shed, or storage unit. A Room is an area inside that storage space, such as Kitchen, Garage, Bedroom, Cab, or Rear Cargo. A Compartment is a smaller place inside a room, such as a drawer, cabinet, bin, box, shelf, or under-seat area. An Item is the actual piece of gear stored in a compartment.",
  },
  {
    question: "What is a Room?",
    answer:
      "A Room is an area inside a Storage Space that helps organize compartments. Examples include Kitchen, Garage, Bedroom, Cab, Rear Cargo, Office Area, or Utility Area. Rooms make it easier to group compartments before adding individual items.",
  },
  {
    question: "What is a Compartment?",
    answer:
      "A Compartment is a smaller area inside a Room or Storage Space. Examples include a drawer, cabinet, bin, box, shelf, rear cargo area, or under-seat storage area.",
  },
  {
    question: "What is a Storage Space?",
    answer:
      "A Storage Space is the larger place where your gear is stored, such as a van, truck, RV, garage, shed, storage unit, or other location.",
  },
  {
    question: "What is an Item?",
    answer:
      "An Item is a piece of gear stored inside a compartment. Items can include a quantity, packed status, and an optional photo.",
  },
  {
    question: "Can I move an Item to another Compartment?",
    answer:
      "Yes. Open the Item card inside a Compartment, tap Move, choose the destination Storage Space, then choose the destination Compartment. The Item will move without being deleted, and its name, quantity, packed status, notes, and photo stay with it.",
  },
  {
    question: "What is the difference between a Checklist and a Template?",
    answer:
      "A Checklist is an active packing list used to track what is Packed and what is still To Pack for a trip, activity, or gear setup. A Template is a reusable packing blueprint that helps you quickly create future checklists without starting over. Create Template saves the reusable blueprint under Manage Templates. New Blank Checklist creates an active checklist under Active Checklists. A common workflow is: Template, create Checklist, then pack items.",
  },  {
    question: "Will I get reminders for Upcoming Trips?",
    answer:
      "Upcoming Trips reminders are planned for a future update. You will be able to receive notifications as your trip date approaches.",
  },
];

export default function FAQScreen() {
  const theme = useThemedValues();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggleItem(index: number) {
    setOpenIndex((current) => (current === index ? null : index));
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title="FAQ" showBackButton backHref="/(tabs)/profile" />

          <ThemedCard style={styles.heroCard}>
            <ThemedText variant="title" style={styles.heroTitle}>
              Frequently Asked Questions
            </ThemedText>

            <ThemedText color="secondary" style={styles.heroText}>
              Quick answers about storage spaces, rooms, compartments,
              items, checklists, offline use, Gear Assistant, Siri Shortcuts, photos,
              notes, and account data.
            </ThemedText>
          </ThemedCard>

          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <ThemedCard key={item.question}>
                <HapticPressable
                  style={styles.questionRow}
                  onPress={() => toggleItem(index)}
                >
                  <ThemedText
                    variant="bodyStrong"
                    style={styles.questionText}
                  >
                    {item.question}
                  </ThemedText>

                  {isOpen ? (
                    <ChevronUp size={18} color={theme.colors.textSecondary} />
                  ) : (
                    <ChevronDown size={18} color={theme.colors.textSecondary} />
                  )}
                </HapticPressable>

                {isOpen ? (
                  <ThemedText color="secondary" style={styles.answerText}>
                    {item.answer}
                  </ThemedText>
                ) : null}
              </ThemedCard>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    padding: 16,
    paddingBottom: 140,
  },

  heroCard: {
    marginBottom: 16,
  },

  heroTitle: {
    marginBottom: 6,
  },

  heroText: {
    lineHeight: 20,
  },

  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  questionText: {
    flex: 1,
    lineHeight: 21,
  },

  answerText: {
    lineHeight: 20,
    marginTop: 12,
  },
});