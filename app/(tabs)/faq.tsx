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
      "Where's My Gear helps you track gear by storage space, compartment, and checklist so you know where items are located and what still needs to be packed.",
  },
  {
    question: "What are Upcoming Trips?",
    answer:
      "Upcoming Trips help you plan ahead by organizing your packing needs by date. You can create a trip, assign a date, and track what needs to be packed before you leave.",
  },
  {
    question: "How do I use Upcoming Trips?",
    answer:
      "Create a trip from the Dashboard, select your trip date, and add or link a checklist. As your trip approaches, you can track your progress using Packed and To Pack items.",
  },
  {
    question: "Will I get reminders for Upcoming Trips?",
    answer:
      "Upcoming Trips reminders are planned for a future update. You will be able to receive notifications as your trip date approaches.",
  },
  {
    question: "What is a Storage Space?",
    answer:
      "A Storage Space is the larger place where your gear is stored, such as a van, truck, RV, garage, shed, storage unit, or other location.",
  },
  {
    question: "What is a Compartment?",
    answer:
      "A Compartment is a smaller area inside a Storage Space. Examples include a drawer, cabinet, bin, box, shelf, rear cargo area, or under-seat storage area.",
  },
  {
    question: "What is an Item?",
    answer:
      "An Item is a piece of gear stored inside a compartment. Items can include a quantity, packed status, and an optional photo.",
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
    question: "How do Checklists work?",
    answer:
      "Checklists help you plan what to pack. You can create a checklist, add items, assign checklist items to a storage space and compartment, and mark items as packed.",
  },
  {
    question: "Can I save notes?",
    answer:
      "Yes. Notes are saved by Storage Space. Open Notes from the Dashboard to add storage-specific notes. Notes auto-save while you type and can also be saved manually.",
  },
  {
    question: "What can I search for?",
    answer:
      "Dashboard search can find Items, Storage Spaces, Compartments, and Checklists. You can search by names, storage types, packed status, or To Pack status.",
  },
  {
    question: "Can I add photos to items?",
    answer:
      "Yes. You can take a photo or choose one from your device library. Item photos help you identify gear faster.",
  },
  {
    question: "Does Where's My Gear use Apple sign-in?",
    answer:
      "Yes. The app uses Apple sign-in, so you do not need to create or manage a separate password inside the app.",
  },
  {
    question: "What happens if I delete all data?",
    answer:
      "Delete All Data permanently removes your Storage Spaces, Compartments, Inventory Items, Checklists, Checklist Items, and Checklist Templates. Notes saved to Storage Spaces are also removed. This action cannot be undone.",
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
              Quick answers about storage spaces, compartments, items,
              checklists, notes, photos, and account data.
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