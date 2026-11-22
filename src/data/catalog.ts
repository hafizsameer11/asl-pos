/**
 * The ASL ORIGINALS catalogue, taken from the website/app prototype (src/lib/shop-data.ts):
 * same product ids, names, brands, prices, sale prices, sizes and photos.
 * In the real build the till reads products from the same backend as the website and app.
 */
import type { CatalogItem } from "./types";

export const CATALOG: CatalogItem[] = [
  {
    "id": "c1",
    "name": "Alias T-Shirt - Black",
    "brand": "DAILY PAPER",
    "category": "Clothing",
    "subcategory": "T-shirts",
    "image": "products/p-daily-paper-tee.png",
    "price": 55000,
    "description": "The DAILY PAPER Alias T-Shirt - Black blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c2",
    "name": "Club Fleece Hoodie - Green",
    "brand": "NIKE",
    "category": "Clothing",
    "subcategory": "Hoodies & Sweatshirts",
    "image": "products/p-nike-hoodie-green.png",
    "price": 120000,
    "description": "The NIKE Club Fleece Hoodie - Green blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Green",
      "hex": "#2d5a3d"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "XXL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c3",
    "name": "Varsity Jacket - Cream",
    "brand": "AAPE",
    "category": "Clothing",
    "subcategory": "Jackets & Jumpers",
    "image": "products/p-aape-jacket.png",
    "price": 180000,
    "description": "The AAPE Varsity Jacket - Cream blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Beige",
      "hex": "#edebdf"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "Limited Pieces",
    "soldOut": true
  },
  {
    "id": "c4",
    "name": "R3 Denim - Light Blue",
    "brand": "REPRESENT",
    "category": "Clothing",
    "subcategory": "Jeans & Trousers",
    "image": "products/p-represent-denim.png",
    "price": 150000,
    "description": "The REPRESENT R3 Denim - Light Blue blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Blue",
      "hex": "#7aa3c8"
    },
    "sizes": [
      "30",
      "32",
      "34",
      "36"
    ],
    "availability": "In Stock",
    "priceOnRequest": true,
    "sizeLabels": {
      "30": "S (30)",
      "32": "M (32)",
      "34": "L (34)",
      "36": "XL (36)"
    }
  },
  {
    "id": "c5",
    "name": "Fleece Shorts - Black",
    "brand": "ESSENTIALS",
    "category": "Clothing",
    "subcategory": "Jorts/shorts",
    "image": "products/p-essentials-shorts.png",
    "price": 85000,
    "description": "The ESSENTIALS Fleece Shorts - Black blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "Restocked"
  },
  {
    "id": "f1",
    "name": "Dunk Low Retro - Black White",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-nike-dunk.png",
    "price": 160000,
    "description": "The NIKE Dunk Low Retro - Black White pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Multicolour",
      "hex": "#9a9a9a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44",
      "45"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c6",
    "name": "Owners Club Hoodie - Black",
    "brand": "REPRESENT",
    "category": "Clothing",
    "subcategory": "Hoodies & Sweatshirts",
    "image": "products/p-represent-hoodie.png",
    "price": 185000,
    "description": "The REPRESENT Owners Club Hoodie - Black blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "a1",
    "name": "MA Logo Cap - Black",
    "brand": "AMIRI",
    "category": "Accessories",
    "subcategory": "Hats & Caps",
    "image": "products/p-amiri-cap.png",
    "price": 90000,
    "description": "The AMIRI MA Logo Cap - Black finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c7",
    "name": "Represent Owners Club Tee",
    "brand": "DAILY PAPER",
    "category": "Clothing",
    "subcategory": "T-shirts",
    "image": "products/p-tee.png",
    "price": 65000,
    "description": "The DAILY PAPER Represent Owners Club Tee blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c8",
    "name": "Daily Paper Hoodie",
    "brand": "DAILY PAPER",
    "category": "Clothing",
    "subcategory": "Hoodies & Sweatshirts",
    "image": "products/p-hoodie.png",
    "price": 65000,
    "description": "The DAILY PAPER Daily Paper Hoodie blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Beige",
      "hex": "#edebdf"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "Pre Order"
  },
  {
    "id": "f2",
    "name": "Air Force 1 '07",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-sneaker.png",
    "price": 115000,
    "description": "The NIKE Air Force 1 '07 pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "White",
      "hex": "#ffffff"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "Restocked"
  },
  {
    "id": "f3",
    "name": "MA Pool Slides",
    "brand": "AMIRI",
    "category": "Footwear",
    "subcategory": "Flip Flops & Sliders",
    "image": "products/p-slides.png",
    "price": 165000,
    "description": "The AMIRI MA Pool Slides pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43"
    ],
    "availability": "In Stock"
  },
  {
    "id": "a2",
    "name": "9Forty Cap",
    "brand": "NEW ERA",
    "category": "Accessories",
    "subcategory": "Hats & Caps",
    "image": "products/p-cap.png",
    "price": 28000,
    "description": "The NEW ERA 9Forty Cap finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "a3",
    "name": "GM-2100-1AER - Metal Covered Series",
    "brand": "G-SHOCK",
    "category": "Accessories",
    "subcategory": "Watches",
    "image": "products/p-watch.png",
    "price": 235000,
    "description": "The G-SHOCK GM-2100-1AER - Metal Covered Series finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black / Silver",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "Restocked",
    "priceOnRequest": true
  },
  {
    "id": "a4",
    "name": "GBD-200-9ER",
    "brand": "CASIO",
    "category": "Accessories",
    "subcategory": "Watches",
    "image": "products/p-watch2.png",
    "price": 150000,
    "description": "The CASIO GBD-200-9ER finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "Limited Pieces"
  },
  {
    "id": "fr1",
    "name": "Aventus Eau de Parfum",
    "brand": "CREED",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 450000,
    "description": "Aventus Eau de Parfum - an evocative composition by CREED. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "50ml",
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c9",
    "name": "Alias T-Shirt - White",
    "brand": "DAILY PAPER",
    "category": "Clothing",
    "subcategory": "T-shirts",
    "image": "products/p-tee2.png",
    "price": 85000,
    "description": "The DAILY PAPER Alias T-Shirt - White blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "White",
      "hex": "#ffffff"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c10",
    "name": "Club Fleece Hoodie - Grey",
    "brand": "NIKE",
    "category": "Clothing",
    "subcategory": "Hoodies & Sweatshirts",
    "image": "products/p-hoodie.png",
    "price": 110000,
    "description": "The NIKE Club Fleece Hoodie - Grey blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Grey",
      "hex": "#808080"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "XXL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c11",
    "name": "Fleece Shorts - Grey",
    "brand": "ESSENTIALS",
    "category": "Clothing",
    "subcategory": "Jorts/shorts",
    "image": "products/p-essentials-shorts.png",
    "price": 55000,
    "description": "The ESSENTIALS Fleece Shorts - Grey blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Grey",
      "hex": "#808080"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c12",
    "name": "R3 Denim - Dark Blue",
    "brand": "REPRESENT",
    "category": "Clothing",
    "subcategory": "Jeans & Trousers",
    "image": "products/p-represent-denim.png",
    "price": 145000,
    "description": "The REPRESENT R3 Denim - Dark Blue blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Blue",
      "hex": "#3b5a7a"
    },
    "sizes": [
      "30",
      "32",
      "34",
      "36"
    ],
    "availability": "In Stock"
  },
  {
    "id": "c13",
    "name": "Varsity Jacket - Black",
    "brand": "AAPE",
    "category": "Clothing",
    "subcategory": "Jackets & Jumpers",
    "image": "products/p-aape-jacket.png",
    "price": 175000,
    "description": "The AAPE Varsity Jacket - Black blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "Limited Pieces",
    "priceOnRequest": true
  },
  {
    "id": "f4",
    "name": "Air Force 1 '07 - Black",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-sneaker.png",
    "price": 120000,
    "description": "The NIKE Air Force 1 '07 - Black pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "In Stock"
  },
  {
    "id": "f5",
    "name": "Dunk Low Retro - White Grey",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-nike-dunk.png",
    "price": 155000,
    "description": "The NIKE Dunk Low Retro - White Grey pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Multicolour",
      "hex": "#9a9a9a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44",
      "45"
    ],
    "availability": "Restocked"
  },
  {
    "id": "f6",
    "name": "MA Pool Slides - White",
    "brand": "AMIRI",
    "category": "Footwear",
    "subcategory": "Flip Flops & Sliders",
    "image": "products/p-slides.png",
    "price": 155000,
    "description": "The AMIRI MA Pool Slides - White pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "White",
      "hex": "#ffffff"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43"
    ],
    "availability": "In Stock"
  },
  {
    "id": "f7",
    "name": "Air Force 1 '07 - White",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-sneaker.png",
    "price": 115000,
    "description": "The NIKE Air Force 1 '07 - White pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "White",
      "hex": "#ffffff"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "Pre Order",
    "priceOnRequest": true
  },
  {
    "id": "f8",
    "name": "Achilles Low - Black",
    "brand": "COMMON PROJECTS",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-sneaker-black.png",
    "price": 285000,
    "description": "The COMMON PROJECTS Achilles Low - Black pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "In Stock"
  },
  {
    "id": "f9",
    "name": "Genesis Runner - Grey",
    "brand": "AXEL ARIGATO",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-runner-grey.png",
    "price": 195000,
    "description": "The AXEL ARIGATO Genesis Runner - Grey pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Grey",
      "hex": "#808080"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "In Stock"
  },
  {
    "id": "f10",
    "name": "Brixton Leather Loafer - Black",
    "brand": "GUCCI",
    "category": "Footwear",
    "subcategory": "Shoes",
    "image": "products/p-loafer.png",
    "price": 450000,
    "description": "The GUCCI Brixton Leather Loafer - Black pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "Limited Pieces"
  },
  {
    "id": "f11",
    "name": "Dunk Low Retro - Panda",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-nike-dunk.png",
    "price": 170000,
    "compareAt": 226500,
    "description": "The NIKE Dunk Low Retro - Panda pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Multicolour",
      "hex": "#9a9a9a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44",
      "45"
    ],
    "availability": "Restocked"
  },
  {
    "id": "f12",
    "name": "MA Pool Slides - Bone",
    "brand": "AMIRI",
    "category": "Footwear",
    "subcategory": "Flip Flops & Sliders",
    "image": "products/p-slides.png",
    "price": 150000,
    "compareAt": 214500,
    "description": "The AMIRI MA Pool Slides - Bone pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Beige",
      "hex": "#edebdf"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43"
    ],
    "availability": "In Stock"
  },
  {
    "id": "a5",
    "name": "9Forty Cap - Navy",
    "brand": "NEW ERA",
    "category": "Accessories",
    "subcategory": "Hats & Caps",
    "image": "products/p-cap.png",
    "price": 26000,
    "compareAt": 32500,
    "description": "The NEW ERA 9Forty Cap - Navy finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Navy",
      "hex": "#1a3a5f"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "a6",
    "name": "GM-2100-1AER Silver",
    "brand": "G-SHOCK",
    "category": "Accessories",
    "subcategory": "Watches",
    "image": "products/p-watch.png",
    "price": 210000,
    "compareAt": 323000,
    "description": "The G-SHOCK GM-2100-1AER Silver finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Silver",
      "hex": "#c0c0c0"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "a7",
    "name": "GBD-200-9ER Orange",
    "brand": "CASIO",
    "category": "Accessories",
    "subcategory": "Watches",
    "image": "products/p-watch2.png",
    "price": 155000,
    "description": "The CASIO GBD-200-9ER Orange finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Yellow",
      "hex": "#e8b84a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "Limited Pieces"
  },
  {
    "id": "a9",
    "name": "GA-2100-1A1 'CasiOak' Black",
    "brand": "G-SHOCK",
    "category": "Accessories",
    "subcategory": "Watches",
    "image": "products/p-watch.png",
    "price": 195000,
    "description": "The G-SHOCK GA-2100-1A1 'CasiOak' Black finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "a8",
    "name": "MA Logo Cap - White",
    "brand": "AMIRI",
    "category": "Accessories",
    "subcategory": "Hats & Caps",
    "image": "products/p-amiri-cap.png",
    "price": 90000,
    "compareAt": 112500,
    "description": "The AMIRI MA Logo Cap - White finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "White",
      "hex": "#ffffff"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr2",
    "name": "Aventus EDP - 100ml",
    "brand": "CREED",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 480000,
    "description": "Aventus EDP - 100ml - an evocative composition by CREED. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr3",
    "name": "Oud Wood Eau de Parfum",
    "brand": "TOM FORD",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 520000,
    "description": "Oud Wood Eau de Parfum - an evocative composition by TOM FORD. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "50ml",
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr4",
    "name": "Sauvage Eau de Parfum",
    "brand": "DIOR",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 380000,
    "compareAt": 447000,
    "description": "Sauvage Eau de Parfum - an evocative composition by DIOR. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "60ml",
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr5",
    "name": "Bleu de Chanel Eau de Parfum 100ml",
    "brand": "DIOR",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 210000,
    "description": "Bleu de Chanel Eau de Parfum 100ml - an evocative composition by DIOR. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr6",
    "name": "Oud Wood Eau de Parfum 100ml",
    "brand": "TOM FORD",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 330000,
    "description": "Oud Wood Eau de Parfum 100ml - an evocative composition by TOM FORD. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock",
    "priceOnRequest": true
  },
  {
    "id": "fr7",
    "name": "Yves Saint Laurent Y Eau de Parfum 100ml",
    "brand": "YSL",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 185000,
    "compareAt": 264500,
    "description": "Yves Saint Laurent Y Eau de Parfum 100ml - an evocative composition by YSL. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr8",
    "name": "Baccarat Rouge 540 70ml",
    "brand": "MAISON FRANCIS KURKDJIAN",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 385000,
    "description": "Baccarat Rouge 540 70ml - an evocative composition by MAISON FRANCIS KURKDJIAN. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "70ml"
    ],
    "availability": "Limited Pieces"
  },
  {
    "id": "fr9",
    "name": "Silver Mountain Water 100ml",
    "brand": "CREED",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 390000,
    "description": "Silver Mountain Water 100ml - an evocative composition by CREED. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr10",
    "name": "1 Million Eau de Toilette 100ml",
    "brand": "PACO RABANNE",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 128000,
    "compareAt": 170500,
    "description": "1 Million Eau de Toilette 100ml - an evocative composition by PACO RABANNE. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr11",
    "name": "Wood Sage & Sea Salt 100ml",
    "brand": "JO MALONE LONDON",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 145000,
    "description": "Wood Sage & Sea Salt 100ml - an evocative composition by JO MALONE LONDON. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr12",
    "name": "Eros Eau de Parfum 100ml",
    "brand": "VERSACE",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 112000,
    "description": "Eros Eau de Parfum 100ml - an evocative composition by VERSACE. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr13",
    "name": "Coco Mademoiselle EDP 100ml",
    "brand": "CHANEL",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-fragrance.png",
    "price": 245000,
    "description": "Coco Mademoiselle EDP 100ml - an evocative composition by CHANEL. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr14",
    "name": "Tobacco Vanille Travel Spray Set",
    "brand": "TOM FORD",
    "category": "Fragrances",
    "subcategory": "Body Mists",
    "image": "products/p-fragrance.png",
    "price": 195000,
    "description": "Tobacco Vanille Travel Spray Set - an evocative composition by TOM FORD. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "4x10ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "fr15",
    "name": "Aventus Discovery Set",
    "brand": "CREED",
    "category": "Fragrances",
    "subcategory": "Body Mists",
    "image": "products/p-fragrance.png",
    "price": 165000,
    "description": "Aventus Discovery Set - an evocative composition by CREED. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Clear",
      "hex": "#edebdf"
    },
    "sizes": [
      "3x10ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "bs1",
    "name": "Core Logo Hoodie",
    "brand": "ASL ORIGINALS",
    "category": "Clothing",
    "subcategory": "Hoodies & Sweatshirts",
    "image": "products/p-bs-core-hoodie.png",
    "price": 28000,
    "description": "The ASL ORIGINALS Core Logo Hoodie blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "bs2",
    "name": "Oversized T-Shirt",
    "brand": "ASL ORIGINALS",
    "category": "Clothing",
    "subcategory": "T-shirts",
    "image": "products/p-bs-oversized-tee.png",
    "price": 15000,
    "description": "The ASL ORIGINALS Oversized T-Shirt blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "bs3",
    "name": "Air Force 1 '07 Black / White",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-bs-af1-panda.png",
    "price": 160000,
    "compareAt": 200000,
    "description": "The Nike Air Force 1 '07 Black / White pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "In Stock"
  },
  {
    "id": "bs4",
    "name": "Cargo Pants",
    "brand": "ASL ORIGINALS",
    "category": "Clothing",
    "subcategory": "Jeans & Trousers",
    "image": "products/p-bs-cargo-pants.png",
    "price": 24000,
    "description": "The ASL ORIGINALS Cargo Pants blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "bs5",
    "name": "ASL Logo Cap",
    "brand": "ASL ORIGINALS",
    "category": "Accessories",
    "subcategory": "Hats & Caps",
    "image": "products/p-bs-asl-cap.png",
    "price": 8500,
    "description": "The ASL ORIGINALS ASL Logo Cap finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "bs6",
    "name": "Rectangular Sunglasses",
    "brand": "ASL ORIGINALS",
    "category": "Accessories",
    "subcategory": "Sunglasses",
    "image": "products/p-bs-sunglasses.png",
    "price": 12000,
    "description": "The ASL ORIGINALS Rectangular Sunglasses finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock",
    "soldOut": true
  },
  {
    "id": "bs7",
    "name": "Sauvage Eau de Parfum 100ml",
    "brand": "DIOR",
    "category": "Fragrances",
    "subcategory": "Perfumes",
    "image": "products/p-bs-dior-sauvage.png",
    "price": 145000,
    "compareAt": 193500,
    "description": "Sauvage Eau de Parfum 100ml - an evocative composition by Dior. A bold, long-lasting scent designed to leave a signature impression from day to night.",
    "colour": {
      "name": "Navy",
      "hex": "#1a3a5f"
    },
    "sizes": [
      "100ml"
    ],
    "availability": "In Stock"
  },
  {
    "id": "bs8",
    "name": "ASL Sliders",
    "brand": "ASL ORIGINALS",
    "category": "Footwear",
    "subcategory": "Flip Flops & Sliders",
    "image": "products/p-bs-sliders.png",
    "price": 14000,
    "description": "The ASL ORIGINALS ASL Sliders pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "In Stock"
  },
  {
    "id": "tr1",
    "name": "Ownership Washed Tee",
    "brand": "REPRESENT",
    "category": "Clothing",
    "subcategory": "T-shirts",
    "image": "products/p-tr-represent-tee.png",
    "price": 28000,
    "description": "The REPRESENT Ownership Washed Tee blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "tr2",
    "name": "Core Hoodie",
    "brand": "FEAR OF GOD ESSENTIALS",
    "category": "Clothing",
    "subcategory": "Hoodies & Sweatshirts",
    "image": "products/p-tr-fog-hoodie.png",
    "price": 45000,
    "description": "The FEAR OF GOD ESSENTIALS Core Hoodie blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Grey",
      "hex": "#c9c9c9"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "tr3",
    "name": "Relaxed Fit Cargo Pants",
    "brand": "CARGO TROUSERS",
    "category": "Clothing",
    "subcategory": "Jeans & Trousers",
    "image": "products/p-tr-cargo-trousers.png",
    "price": 32000,
    "description": "The CARGO TROUSERS Relaxed Fit Cargo Pants blends heritage tailoring with everyday comfort. Cut from premium fabric with a refined finish, it layers easily across your rotation.",
    "colour": {
      "name": "Olive",
      "hex": "#6b7a3a"
    },
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "availability": "In Stock"
  },
  {
    "id": "tr4",
    "name": "Dunk Low 'Panda'",
    "brand": "NIKE",
    "category": "Footwear",
    "subcategory": "Sneakers & Trainers",
    "image": "products/p-tr-dunk-panda.png",
    "price": 150000,
    "compareAt": 214500,
    "description": "The NIKE Dunk Low 'Panda' pairs an iconic silhouette with modern construction. Premium uppers, cushioned midsole and a durable rubber outsole make it built for the everyday rotation.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "40",
      "41",
      "42",
      "43",
      "44"
    ],
    "availability": "In Stock"
  },
  {
    "id": "tr5",
    "name": "NY Yankees 9FORTY Cap",
    "brand": "NEW ERA",
    "category": "Accessories",
    "subcategory": "Hats & Caps",
    "image": "products/p-tr-ny-cap.png",
    "price": 12000,
    "description": "The NEW ERA NY Yankees 9FORTY Cap finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "tr6",
    "name": "Rectangular Sunglasses",
    "brand": "PRADA",
    "category": "Accessories",
    "subcategory": "Sunglasses",
    "image": "products/p-tr-prada-sunglasses.png",
    "price": 38000,
    "compareAt": 44500,
    "description": "The PRADA Rectangular Sunglasses finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock",
    "soldOut": true
  },
  {
    "id": "tr7",
    "name": "Vintage Digital Watch",
    "brand": "CASIO",
    "category": "Accessories",
    "subcategory": "Watches",
    "image": "products/p-tr-casio-watch.png",
    "price": 26000,
    "description": "The CASIO Vintage Digital Watch finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Silver",
      "hex": "#c0c0c0"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  },
  {
    "id": "tr8",
    "name": "Utility Crossbody Bag",
    "brand": "ASL ORIGINALS",
    "category": "Accessories",
    "subcategory": "Bags",
    "image": "products/p-tr-crossbody-bag.png",
    "price": 10000,
    "description": "The ASL ORIGINALS Utility Crossbody Bag finishes any look with intent. Crafted from premium materials with attention to every stitch, seam and edge.",
    "colour": {
      "name": "Black",
      "hex": "#0a0a0a"
    },
    "sizes": [
      "One Size"
    ],
    "availability": "In Stock"
  }
];
