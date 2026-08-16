/**
 * The question set. Edit this file to change the quiz — `seed.ts` reads it and
 * writes exactly these rows, in this order, deleting anything else first.
 *
 * Lives under server/ deliberately: nothing here is ever bundled into the
 * client, so `correctKey` cannot reach a participant's browser.
 */

export type OptionKey = 'a' | 'b' | 'c' | 'd';

export interface Riddle {
  prompt: string;
  imageUrl?: string;
  options: Array<{ key: OptionKey; label: string }>;
  correctKey: OptionKey;
}

export const riddles: Riddle[] = [
  {
    prompt: "Which of the following anime's original light novel was released the earliest?",
    options: [
      { key: 'a', label: 'Apothecary Diaries' },
      { key: 'b', label: '86' },
      { key: 'c', label: 'Classroom of the Elite' },
      { key: 'd', label: 'Violet Evergarden' },
    ],
    correctKey: 'a',
  },
  {
    prompt: 'What is the name of the main band in K-ON!',
    options: [
      { key: 'a', label: 'Wakaba Girls' },
      { key: 'b', label: 'Hokago Tea Time' },
      { key: 'c', label: 'Death Devil' },
      { key: 'd', label: 'Light Music' },
    ],
    correctKey: 'b',
  },
  {
    prompt: "What is Gojo's infinity a reference of?",
    options: [
      { key: 'a', label: 'Achilles and the tortoise' },
      { key: 'b', label: 'Achilles and the snail' },
      { key: 'c', label: 'Hermes and the turtle' },
      { key: 'd', label: 'Hermes and the ant' },
    ],
    correctKey: 'a',
  },
  {
    prompt: 'Which of the following arcade rhythm games is NOT developed by SEGA?',
    options: [
      { key: 'a', label: 'maimai' },
      { key: 'b', label: 'CHUNITHM' },
      { key: 'c', label: 'O.N.G.E.K.I.' },
      { key: 'd', label: 'Sound Voltex' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'One of these is not like the others...',
    options: [
      { key: 'a', label: 'Kaguya-Sama: Love is War' },
      { key: 'b', label: 'Toradora' },
      { key: 'c', label: 'Your lie in April' },
      { key: 'd', label: 'Tomochan' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'How many resets has Subaru experienced until the end of Re:Zero season 4 cour 1?',
    options: [
      { key: 'a', label: '14' },
      { key: 'b', label: '19' },
      { key: 'c', label: '27' },
      { key: 'd', label: '33' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'How many standard pathways are there in Lord of the Mysteries?',
    options: [
      { key: 'a', label: '7' },
      { key: 'b', label: '10' },
      { key: 'c', label: '22' },
      { key: 'd', label: '32' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'How many heroes are allowed to compete for the X position in To Be Hero X',
    options: [
      { key: 'a', label: '3' },
      { key: 'b', label: '7' },
      { key: 'c', label: '10' },
      { key: 'd', label: '12' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'What song did Kasane Teto finally perform in her first appearance on stage with Hatsune Miku',
    options: [
      { key: 'a', label: 'Mesmerizer - 32ki' },
      { key: 'b', label: 'Odochina - Atena' },
      { key: 'c', label: 'CandyCookieChocolate - Hallo Cel' },
      { key: 'd', label: 'See You Again' },
    ],
    correctKey: 'a',
  },
  {
    prompt: "Which of these albums do not feature a 'Jojo stand', ie. none of the songs are stands?",
    options: [
      { key: 'a', label: 'Sheer Heart Attack by Queen (Killer Queen /Yoshikage Kira)' },
      { key: 'b', label: 'Tusk by Fleetwood Mac (Tusk /Johnny Joestar)' },
      { key: 'c', label: 'Meddle by Pink Floyd (Echoes/ Koichi)' },
      { key: 'd', label: 'Travelling without Moving by Jamiroquai (-)' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Guess the song from the lyrics!\n\n“Even now, blue resides”',
    options: [
      { key: 'a', label: 'EVERBLUE - Omoinotake' },
      { key: 'b', label: 'Same blue - Official Hige DANdism' },
      { key: 'c', label: 'Blue Train - Asian Kung Fu Generation' },
      { key: 'd', label: 'Where our blue is - Tatsuya Kitani' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Which of the Songs below won the Music Awards Japan 2026 for Song of the Year?',
    options: [
      { key: 'a', label: 'Iris Out - Kenshi Yonezu' },
      { key: 'b', label: 'Kaiju - Sakanaction' },
      { key: 'c', label: 'Jane Doe - Kenshi Yonezu ft. Hikaru Utada' },
      { key: 'd', label: 'A Spoonful of SPELL - r906' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'What is the numerical difference between the lowest difficulty level and the highest difficulty level of official charts in Project Sekai: Colorful Stage! feat. Hatsune Miku (Japanese Server)?',
    options: [
      { key: 'a', label: '32' },
      { key: 'b', label: '33' },
      { key: 'c', label: '37' },
      { key: 'd', label: '38' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Which region has NOT appeared in an event story/main story chapter of Reverse:1999',
    options: [
      { key: 'a', label: 'Africa' },
      { key: 'b', label: 'Russia' },
      { key: 'c', label: 'South America' },
      { key: 'd', label: 'Space' },
    ],
    correctKey: 'a',
  },
  {
    prompt: "How many parts are there in the Jojo's Bizarre Adventure series (JJBA)?",
    options: [
      { key: 'a', label: '6' },
      { key: 'b', label: '8' },
      { key: 'c', label: '10' },
      { key: 'd', label: '9' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'In episode 5 of the anime series Lucky Star, the series drops a major spoiler for a visual novel. Which visual novel did they spoil?',
    options: [
      { key: 'a', label: 'Umineko' },
      { key: 'b', label: 'Fate Stay Night' },
      { key: 'c', label: 'Danganronpa' },
      { key: 'd', label: 'Mahoyo' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'How did Hanma Baki recover from the lethal poison inflicted by Ryuukou Yanagi?',
    options: [
      { key: 'a', label: 'Get himself another dose of poison to counter it' },
      { key: 'b', label: 'Chugging a full-course meal and 10 litres of water with 4 kilograms of fructose' },
      { key: 'c', label: 'Pure Hanma blood lineage' },
      { key: 'd', label: 'All of the Above' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Which of these artists has NOT done a song for Pokemon?',
    options: [
      { key: 'a', label: 'Jason Paige' },
      { key: 'b', label: 'Kenshi Yonezu' },
      { key: 'c', label: 'YOASOBI' },
      { key: 'd', label: 'Ed Sheeran' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Which Hololive member was the first to reach 1 million YouTube subscribers?',
      { key: 'a', label: 'Houshou Marine' },
      { key: 'b', label: 'Kobo Kanaeru' },
      { key: 'c', label: 'Gawr Gura' },
      { key: 'd', label: 'Shirakami Fubuki' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'How many touch sensors are there on each screen of a maimai DX cabinet?',
    options: [
      { key: 'a', label: '34' },
      { key: 'b', label: '22' },
      { key: 'c', label: '16' },
      { key: 'd', label: '18' },
    ],
    correctKey: 'a',
  },
  {
    prompt: 'In the world of Cyberpunk™ , what is the name of the most feared antagonist that is not Arasaka?',
    options: [
      { key: 'a', label: 'Adam Smasher' },
      { key: 'b', label: 'Johnny Silverhand' },
      { key: 'c', label: 'V' },
      { key: 'd', label: 'Arasaka' },
    ],
    correctKey: 'a',
  },
  {
    prompt: "How many different outfits does best girl Ch’en have in Arknights?\n\nINCLUDES all base skins, E2 skins, and story-only outfits.",
    options: [
      { key: 'a', label: '8' },
      { key: 'b', label: '9' },
      { key: 'c', label: '12' },
      { key: 'd', label: '15' },
    ],
    correctKey: 'c',
  },
  {
    prompt: "How many VTuber Talents have ever officially debuted and existed under the Hololive Production?",
    options: [
      { key: 'a', label: '87' },
      { key: 'b', label: '113' },
      { key: 'c', label: '102' },
      { key: 'd', label: '122' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Which of the following anime was infamous for airing eight episodes of essentially the same events.',
    options: [
      { key: 'a', label: 'Monogatari Series' },
      { key: 'b', label: 'Higurashi' },
      { key: 'c', label: 'The Melancholy of Suzumiya Haruhi' },
      { key: 'd', label: 'Kara no Kyoukai' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'Which of these video game franchises does NOT have an anime movie?',
    options: [
      { key: 'a', label: 'Street Fighter' },
      { key: 'b', label: 'Professor Layton' },
      { key: 'c', label: 'Devil May Cry' },
      { key: 'd', label: 'Megaman/Rockman' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'In the hit game Balatro™, you win the game by getting scores more than the blind. Which ante do you have to beat to finish the standard playthrough of your run?',
    options: [
      { key: 'a', label: 'Naneinf' },
      { key: 'b', label: '8' },
      { key: 'c', label: '10' },
      { key: 'd', label: '39' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Are you required to attend all our sessions every week?',
    options: [
      { key: 'a', label: "No, attendance is completely flexible (though we'd love to see you!)" },
      { key: 'b', label: 'Yes, 100% attendance is strictly required' },
      { key: 'c', label: 'Yes, minimum 80% attendance to stay a member' },
      { key: 'd', label: 'No, only if you successful submit a valid excuse letter' },
    ],
    correctKey: 'a',
  },
  {
    prompt: 'Which of the following is NOT one of the 3 departments of NUSCAS?',
    options: [
      { key: 'a', label: 'TOPICS' },
      { key: 'b', label: 'TryHards' },
      { key: 'c', label: 'CASuals' },
      { key: 'd', label: 'Palette' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'What was the lowest accuracy judgement in CHUNITHM called during its development?',
    options: [
      { key: 'a', label: 'Miss' },
      { key: 'b', label: 'Fault' },
      { key: 'c', label: 'Error' },
      { key: 'd', label: 'Guilty' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'How many children did Qifrey train (kidnap) in the Witch Hat Atelier anime',
    options: [
      { key: 'a', label: '1' },
      { key: 'b', label: '2' },
      { key: 'c', label: '3' },
      { key: 'd', label: '4' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Which chapter of Jujutsu Kaisen did this panel come from?',
    imageUrl: 'images/nah-id-win.webp',
    options: [
      { key: 'a', label: 'Chapter 236' },
      { key: 'b', label: 'Chapter 221' },
      { key: 'c', label: 'Chapter 223' },
      { key: 'd', label: 'Chapter 235' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Which of these VTubers is NOT generally considered one of the pioneers of the modern VTuber scene?',
    options: [
      { key: 'a', label: 'Kizuna AI' },
      { key: 'b', label: 'Tokino Sora' },
      { key: 'c', label: 'Mirai Akari' },
      { key: 'd', label: 'Tsukino Mito' },
    ],
    correctKey: 'd',
  },
  {
    prompt: "Snapshotting is a powerful mechanic in Genshin Impact where a character’s Elemental Skill or Burst damage is calculated based on the character’s stats at the moment they use the ability.\n\nWhich of the following characters’ talent snapshots?",
    options: [
      { key: 'a', label: 'Fischl’s Elemental Burst: Midnight Phantasmagoria' },
      { key: 'b', label: 'Yae Miko’s Elemental Skill: Yakan Evocation: Sesshou Sakura' },
      { key: 'c', label: 'Zhongli’s Elemental Skill: Dominus Lapidis' },
      { key: 'd', label: 'Xinyan’s Elemental Skill: Sweeping Fervor' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'Science Adventure, commonly shortened to SciADV, is a video game series and Multimedia franchise consisting of interconnected science fiction stories, with the main entries mostly take the form of visual novels\n\nWhich of the following is the first entry in this series?',
    options: [
      { key: 'a', label: 'Steins;Gate' },
      { key: 'b', label: 'Chaos;Child' },
      { key: 'c', label: 'Chaos;Head' },
      { key: 'd', label: 'Robotics;Notes' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'What is the name of the city-state where Arknights begins?',
    options: [
      { key: 'a', label: 'Lungmen' },
      { key: 'b', label: 'Chernobog },
      { key: 'c', label: 'Laterano' },
      { key: 'd', label: 'Kazimierz' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'In the original Fuyuki Holy Grail War, only one of the 19 Hassans can be summoned as Assassin (Sasaki Kojirou being an anomaly). Why?',
    options: [
      { key: 'a', label: 'Assassins are rarely honored as heroes, making Hassan the only qualifier' },
      { key: 'b', label: 'The 19 personas of Hassan represent the absolute peak of stealth' },
      { key: 'c', label: 'The word "Assassin" derives from Hassan-i-Sabbah, hardcoding him as the class default' },
      { key: 'd', label: 'The Einzberns designed the class specifically for the Hassan lineage' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'Arifumi Imai is a highly acclaimed Japanese animator known for his work on Attack on Titan, Jujutsu Kaisen, and One-Punch Man.\n\nApproximately how long did it take him to animate the famous Levi chase scene in Attack on Titan Season 3 Part 1?',
    options: [
      { key: 'a', label: '2 weeks' },
      { key: 'b', label: '1 month' },
      { key: 'c', label: '3 months' },
      { key: 'd', label: '6 months' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'In an interview, Saka Mikami (author of The Fragrant Flower Blooms with Dignity) revealed that reading the heartbreaking ending of which manga inspired her to create a gentle, heartwarming story of her own?',
    options: [
      { key: 'a', label: 'Your Lie in April' },
      { key: 'b', label: 'Scum’s Wish' },
      { key: 'c', label: 'Attack on Titan' },
      { key: 'd', label: 'Domestic Girlfriend' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'What was the Oxford Word of the Year 2026?',
    options: [
      { key: 'a', label: 'Brain rot' },
      { key: 'b', label: 'Rage bait' },
      { key: 'c', label: 'Aura farming' },
      { key: 'd', label: 'Lowkirkenuinely' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Luck test :D',
    options: [
      { key: 'a', label: 'Click to win' },
      { key: 'b', label: 'Nah id win' },
      { key: 'c', label: 'Pick me bro' },
      { key: 'd', label: 'Lets go gambling' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Which of the following Shinto mythology-inspired names is NOT a Mangekyou Sharingan jutsu in Naruto?',
    options: [
      { key: 'a', label: 'Kamui' },
      { key: 'b', label: 'Amaterasu' },
      { key: 'c', label: 'Tsukuyomi' },
      { key: 'd', label: 'Tenkan' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Kevin Penkin is celebrated for his atmospheric scores like Made in Abyss and Tower of God. Which of these anime did he NOT compose the music for?',
    options: [
      { key: 'a', label: 'The Apothecary Diaries' },
      { key: 'b', label: 'Spice and Wolf: Merchant Meets the Wise Wolf' },
      { key: 'c', label: 'The Rising of the Shield Hero' },
      { key: 'd', label: 'Land of the Lustrous (Houseki no Kuni)' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Which of these songs is NOT a Detective Conan opening?',
    options: [
      { key: 'a', label: 'As the Dew' },
      { key: 'b', label: 'Misty Mystery' },
      { key: 'c', label: 'Miss Mystery' },
      { key: 'd', label: 'MisFORTUNE' },
    ],
    correctKey: 'd',
  },
  {
    prompt: 'Which recent viral meme song is commonly used in edits and comments to call someone a larper?',
    options: [
      { key: 'a', label: 'Charlie’s Inferno' },
      { key: 'b', label: 'Looping in the room' },
      { key: 'c', label: 'Thick of It' },
      { key: 'd', label: 'Flower Man' },
    ],
    correctKey: 'a',
  },
  {
    prompt: 'Which of these characters is NOT a member of the Genius Society in Honkai Star Rail?',
    options: [
      { key: 'a', label: 'Dr. Ratio' },
      { key: 'b', label: 'Dr. Primitive' },
      { key: 'c', label: 'Lambda' },
      { key: 'd', label: 'Polka Kakamond' },
    ],
    correctKey: 'a',
  },
  {
    prompt: 'The famous classic performance "Time Noodles" originates from which traditional Japanese performing art?',
    options: [
      { key: 'a', label: 'Enko' },
      { key: 'b', label: 'Rakugo' },
      { key: 'c', label: 'Kabuki' },
      { key: 'd', label: 'Bunraku' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Which of the following songs was NOT produced by the vocal synth music circle FLAVOR FOLEY (or its individual members)?',
    options: [
      { key: 'a', label: 'Streetcat' },
      { key: 'b', label: 'Birdbrain' },
      { key: 'c', label: 'Running on a rope' },
      { key: 'd', label: 'Machine Love' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'During the Taishō era (1912–1926), Japan experienced a cultural movement called Taishō Roman, marked by urbanization, new artistic styles, and a fascination with modernity. Which fashion trend best reflects this era?',
    options: [
      { key: 'a', label: 'Elaborate court kimonos reserved for aristocracy' },
      { key: 'b', label: 'Casual everyday wear combining Japanese and Western elements' },
      { key: 'c', label: 'Military-style uniforms adopted by schools and youth organizations' },
      { key: 'd', label: 'Traditional rural farmer clothing' },
    ],
    correctKey: 'b',
  },
  {
    prompt: 'Which of these is NOT a ZZZ Bangboo?',
    options: [
      { key: 'a', label: 'Robin' },
      { key: 'b', label: 'Snap' },
      { key: 'c', label: 'Elfy' },
      { key: 'd', label: 'Ariel' },
    ],
    correctKey: 'c',
  },
  {
    prompt: 'Across both Slay the Spire 1 and Slay the Spire 2, how many total unique playable characters are there?',
    options: [
      { key: 'a', label: '8' },
      { key: 'b', label: '4' },
      { key: 'c', label: '7' },
      { key: 'd', label: '6' },
    ],
    correctKey: 'd',
  },
];
