import destinations from "../../../../config/destinations.json";

export type Destination = (typeof destinations)[number];

export const packages = [
  { id: "hampi-slow-days", title: "Hampi, slowly", destination: "Hampi", duration: "3 days · 2 nights", price: "₹18,500", rating: "4.9", image: destinations[0]!.image, detail: "Ruins, river light & local kitchens" },
  { id: "jaipur-craft-trail", title: "The craft trail", destination: "Jaipur", duration: "2 days · 1 night", price: "₹12,800", rating: "4.8", image: destinations[3]!.image, detail: "Palaces, prints & pink-city rituals" },
  { id: "kochi-coastal-table", title: "Coastal table", destination: "Kochi", duration: "4 days · 3 nights", price: "₹26,400", rating: "5.0", image: destinations[5]!.image, detail: "Spice routes, art & backwater calm" }
] as const;

export const guides = [
  { id: "ananya", name: "Ananya Rao", role: "Heritage storyteller", destination: "Hampi", experience: "8 years guiding", languages: "English · Kannada · Hindi", rating: "4.98", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=85" },
  { id: "rahul", name: "Rahul Mehta", role: "Food & culture host", destination: "Jaipur", experience: "6 years guiding", languages: "English · Hindi · French", rating: "4.97", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=85" },
  { id: "meera", name: "Meera Nair", role: "Coastal life curator", destination: "Kochi", experience: "10 years guiding", languages: "English · Malayalam · Tamil", rating: "4.99", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=85" }
] as const;

export const testimonials = [
  { quote: "Our guide made Hampi feel less like a monument and more like a living conversation. We came home with stories, not just photographs.", name: "Clara M.", location: "London · Hampi, 2024", initials: "CM" },
  { quote: "The small details were everything — the family-run lunch, the quiet palace entrance, the way our guide knew when to slow down.", name: "Arjun & Diya", location: "Mumbai · Jaipur, 2024", initials: "AD" },
  { quote: "It felt personal from the first message. Kochi unfolded at exactly the pace we wanted, with the confidence of someone who truly belongs there.", name: "Nadia K.", location: "Dubai · Kochi, 2024", initials: "NK" }
] as const;

export { destinations };
