/** Quick-jump destinations (approximate bounding boxes, [west, south, east, north]). */
export interface Place {
  name: string;
  region: string;
  bbox: [number, number, number, number];
}

export const PLACES: Place[] = [
  { name: "Sundarbans", region: "West Bengal, India · Bangladesh", bbox: [88.0, 21.5, 89.9, 22.6] },
  { name: "Bhitarkanika", region: "Odisha, India", bbox: [86.75, 20.55, 87.05, 20.85] },
  { name: "Godavari–Coringa", region: "Andhra Pradesh, India", bbox: [82.2, 16.6, 82.45, 16.9] },
  { name: "Pichavaram", region: "Tamil Nadu, India", bbox: [79.75, 11.38, 79.83, 11.47] },
  { name: "Gulf of Kutch", region: "Gujarat, India", bbox: [69.0, 22.3, 70.5, 23.0] },
  { name: "Thane Creek", region: "Maharashtra, India", bbox: [72.9, 19.0, 73.05, 19.25] },
  { name: "Andaman Islands", region: "India", bbox: [92.2, 10.5, 93.1, 13.7] },
  { name: "Mekong Delta (Cà Mau)", region: "Vietnam", bbox: [104.7, 8.5, 105.4, 9.2] },
  { name: "Niger Delta", region: "Nigeria", bbox: [5.0, 4.2, 7.5, 5.8] },
  { name: "Everglades", region: "Florida, USA", bbox: [-81.4, 25.1, -80.6, 25.6] },
];
