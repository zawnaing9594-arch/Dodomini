import { db } from "./db";
import { content, episodes } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(content);
  if (existing[0].count > 0) return;

  const seedContent = [
    {
      title: "Shadow Warriors",
      type: "series",
      thumb: "/images/thumb-1.png",
      banner: "/images/banner-1.png",
      description: "In a world consumed by darkness, a group of elite warriors must rise to protect the last bastions of civilization. Follow their journey through treacherous battles and ancient mysteries.",
    },
    {
      title: "Realm of Enchantment",
      type: "series",
      thumb: "/images/thumb-2.png",
      banner: "/images/banner-2.png",
      description: "A young apprentice discovers a hidden portal to a magical realm filled with wonders and dangers. With the help of mystical allies, she must prevent an ancient evil from awakening.",
    },
    {
      title: "Neon Circuit",
      type: "movie",
      thumb: "/images/thumb-3.png",
      banner: "/images/banner-3.png",
      description: "In a sprawling cyberpunk metropolis, a rogue hacker uncovers a conspiracy that threatens to reshape the digital world forever. Racing against time, alliances are tested and truths revealed.",
    },
    {
      title: "Eternal Sunset",
      type: "movie",
      thumb: "/images/thumb-4.png",
      banner: null,
      description: "Two strangers meet during the golden hour of a summer evening and discover that their fates are intertwined across lifetimes. A beautiful story of love, loss, and redemption.",
    },
    {
      title: "Haunted Grounds",
      type: "series",
      thumb: "/images/thumb-5.png",
      banner: null,
      description: "A paranormal investigation team is called to explore an abandoned mansion with a terrifying history. What they uncover inside will haunt them forever.",
    },
  ];

  const insertedContent = await db.insert(content).values(seedContent).returning();

  const seedEpisodes = [];
  for (const item of insertedContent) {
    if (item.type === "series") {
      const epCount = item.title === "Shadow Warriors" ? 8 : 6;
      for (let i = 1; i <= epCount; i++) {
        const isLocked = i >= 4;
        seedEpisodes.push({
          contentId: item.id,
          epTitle: `Episode ${i}`,
          videoLink: `https://vimeo.com/${700000000 + item.id * 100 + i}`,
          isLocked,
          password: isLocked ? "premium123" : null,
        });
      }
    } else {
      seedEpisodes.push({
        contentId: item.id,
        epTitle: "Full Movie",
        videoLink: `https://vimeo.com/${800000000 + item.id}`,
        isLocked: false,
        password: null,
      });
    }
  }

  if (seedEpisodes.length > 0) {
    await db.insert(episodes).values(seedEpisodes);
  }

  console.log(`Seeded ${insertedContent.length} content items and ${seedEpisodes.length} episodes`);
}
