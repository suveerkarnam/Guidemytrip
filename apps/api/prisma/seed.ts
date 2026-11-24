import "dotenv/config";
import { PrismaClient, RoleCode, AuthProviderType, BookingStatus, PaymentStatus, PackageStatus, GuideApprovalStatus, GuideVerificationStatus } from "@prisma/client";
import destinationsConfig from "../../../config/destinations.json" with { type: "json" };

const prisma = new PrismaClient();

async function main() {
  const roles = await Promise.all([
    prisma.role.upsert({ where: { code: RoleCode.TOURIST }, update: {}, create: { code: RoleCode.TOURIST, description: "Can discover and book experiences" } }),
    prisma.role.upsert({ where: { code: RoleCode.GUIDE }, update: {}, create: { code: RoleCode.GUIDE, description: "Can manage approved guide offerings" } }),
    prisma.role.upsert({ where: { code: RoleCode.ADMIN }, update: {}, create: { code: RoleCode.ADMIN, description: "Can manage the GuideMyTrip platform" } }),
  ]);
  const roleByCode = Object.fromEntries(roles.map((role) => [role.code, role]));

  const languages = await Promise.all([
    ["en", "English"], ["hi", "Hindi"], ["kn", "Kannada"], ["ml", "Malayalam"], ["fr", "French"], ["ta", "Tamil"],
  ].map(([code, name]) => prisma.language.upsert({ where: { code }, update: { name }, create: { code, name } })));
  const languageByCode = Object.fromEntries(languages.map((language) => [language.code, language]));

  const destinations = await Promise.all(destinationsConfig.map((item) => prisma.destination.upsert({
    where: { slug: item.slug },
    update: { name: item.name, region: item.region, description: item.description, imageUrl: item.image },
    create: { slug: item.slug, name: item.name, region: item.region, description: item.description, imageUrl: item.image, attractions: { create: item.highlights.map((name) => ({ name })) } },
  })));
  const destinationBySlug = Object.fromEntries(destinations.map((destination) => [destination.slug, destination]));

  const policy = await prisma.cancellationPolicy.upsert({ where: { id: "00000000-0000-0000-0000-000000000001" }, update: {}, create: { id: "00000000-0000-0000-0000-000000000001", name: "Flexible demo policy", description: "Full refund up to 48 hours before the experience.", freeCancellationHours: 48, refundRules: { before48Hours: 100, before24Hours: 50, under24Hours: 0 } } });
  const packageSeeds = [
    { slug: "hampi-slowly", name: "Hampi, slowly", destination: "hampi", description: "Ruins, river light and local kitchens.", durationDays: 3, basePrice: "18500" },
    { slug: "jaipur-craft-trail", name: "The craft trail", destination: "jaipur", description: "Palaces, prints and pink-city rituals.", durationDays: 2, basePrice: "12800" },
    { slug: "kochi-coastal-table", name: "Coastal table", destination: "kochi", description: "Spice routes, art and backwater calm.", durationDays: 4, basePrice: "26400" },
  ];
  const tourPackages = await Promise.all(packageSeeds.map(async (item) => {
    const destination = destinationBySlug[item.destination]!;
    return prisma.tourPackage.upsert({ where: { slug: item.slug }, update: { name: item.name, description: item.description, basePrice: item.basePrice }, create: { slug: item.slug, name: item.name, description: item.description, durationDays: item.durationDays, capacity: 6, basePrice: item.basePrice, gstRate: "5", status: PackageStatus.PUBLISHED, destinationId: destination.id, cancellationPolicyId: policy.id, images: { create: { url: destination.imageUrl!, altText: `${item.name} demo image` } }, inclusions: { create: [{ item: "Local guide" }, { item: "Curated route" }] }, exclusions: { create: [{ item: "Travel to destination" }] } } });
  }));

  const admin = await prisma.user.upsert({ where: { email: "admin.demo@guidemytrip.local" }, update: {}, create: { email: "admin.demo@guidemytrip.local", displayName: "GuideMyTrip Demo Admin", authProviders: { create: { provider: AuthProviderType.EMAIL, providerAccountId: "demo-admin" } } } });
  const tourist = await prisma.user.upsert({ where: { email: "tourist.demo@guidemytrip.local" }, update: {}, create: { email: "tourist.demo@guidemytrip.local", displayName: "Demo Traveller", authProviders: { create: { provider: AuthProviderType.EMAIL, providerAccountId: "demo-tourist" } } } });
  const guideUser = await prisma.user.upsert({ where: { email: "guide.demo@guidemytrip.local" }, update: {}, create: { email: "guide.demo@guidemytrip.local", displayName: "Ananya Rao", authProviders: { create: { provider: AuthProviderType.EMAIL, providerAccountId: "demo-guide" } } } });
  await prisma.userRole.createMany({ data: [{ userId: admin.id, roleId: roleByCode.ADMIN!.id }, { userId: tourist.id, roleId: roleByCode.TOURIST!.id }, { userId: guideUser.id, roleId: roleByCode.GUIDE!.id }], skipDuplicates: true });
  const guide = await prisma.guideProfile.upsert({ where: { userId: guideUser.id }, update: {}, create: { userId: guideUser.id, experienceYears: 8, biography: "A heritage storyteller and lifelong Hampi local.", profileImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=85", capacity: 4, basePrice: "6500", approvalStatus: GuideApprovalStatus.APPROVED, verificationStatus: GuideVerificationStatus.VERIFIED, isActive: true } });
  await prisma.guideLanguage.createMany({ data: [{ guideId: guide.id, languageId: languageByCode.en!.id, proficiency: "NATIVE" }, { guideId: guide.id, languageId: languageByCode.kn!.id, proficiency: "NATIVE" }, { guideId: guide.id, languageId: languageByCode.hi!.id, proficiency: "FLUENT" }], skipDuplicates: true });
  await prisma.guideDestination.create({ data: { guideId: guide.id, destinationId: destinationBySlug.hampi!.id } }).catch(() => undefined);
  await prisma.guideAvailability.create({ data: { guideId: guide.id, startDate: new Date("2025-01-01"), endDate: new Date("2030-01-01") } }).catch(() => undefined);

  const demoPackage = tourPackages[0]!;
  const demoBooking = await prisma.booking.upsert({ where: { reference: "GTM-DEMO-0001" }, update: {}, create: { reference: "GTM-DEMO-0001", touristId: tourist.id, guideId: guide.id, packageId: demoPackage.id, destinationId: destinationBySlug.hampi!.id, startDate: new Date("2025-02-10"), endDate: new Date("2025-02-12"), tourists12Plus: 2, bookingStatus: BookingStatus.COMPLETED, paymentStatus: PaymentStatus.CAPTURED, baseAmount: "18500", gstAmount: "925", totalAmount: "19425", priceSnapshot: { baseAmount: "18500", gstRate: 5, currency: "INR" }, packageSnapshot: { name: demoPackage.name, durationDays: demoPackage.durationDays } } });
  await prisma.bookingLanguage.create({ data: { bookingId: demoBooking.id, languageId: languageByCode.en!.id } }).catch(() => undefined);
  await prisma.review.upsert({ where: { bookingId: demoBooking.id }, update: {}, create: { bookingId: demoBooking.id, touristId: tourist.id, guideId: guide.id, rating: 5, title: "A beautiful day", body: "Demo review for local development only." } });
  console.log(`Seeded ${destinations.length} destinations, ${tourPackages.length} packages, and demo booking ${demoBooking.reference}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
