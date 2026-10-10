export interface GDTopic {
  id: string;
  title: string;
  category: string;
  context: string;
  seedStatement: string;
}

export const PRESET_TOPICS: GDTopic[] = [
  {
    id: 'ai-jobs',
    title: 'Is Generative AI replacing entry-level tech talent or elevating them?',
    category: 'Technology & Economy',
    context: 'With LLMs capable of writing code, boilerplate tests, and drafting architecture, junior engineers face shifting hiring expectations while senior devs multiply output.',
    seedStatement: 'Good morning everyone. Today we are discussing whether Generative AI is eliminating entry-level tech roles or simply raising the baseline required for modern software engineers. Who would like to initiate?',
  },
  {
    id: 'remote-work',
    title: 'Mandatory Return-to-Office vs Remote First: Innovation, Trust, and Culture',
    category: 'Workplace & Society',
    context: 'Tech giants are enforcing 3-5 days in-office citing serendipitous collaboration, while top performers demand location flexibility and asynchronous autonomy.',
    seedStatement: 'Welcome team. We have 10 minutes to debate mandatory Return-to-Office policies versus asynchronous remote-first cultures. Let us examine the trade-offs between spontaneous innovation and employee autonomy.',
  },
  {
    id: 'social-media-liability',
    title: 'Should algorithm designers and social media platforms bear legal liability for teen mental health?',
    category: 'Ethics & Regulation',
    context: 'Engagement-maximizing recommendation algorithms have been linked to adolescent screen addiction, attention fragmentation, and mental health crises.',
    seedStatement: 'Hello everyone. Today our panel is tackling digital accountability: should social media companies and AI recommender algorithms be legally liable for cognitive and psychological harm in youths?',
  },
  {
    id: 'mobile-phones',
    title: 'Mobile Phone: Advantages and Disadvantages',
    category: 'Society & Daily Life',
    context: 'Smartphones have revolutionized communication, digital payments, and access to learning, but have simultaneously triggered screen addiction, reduced attention spans, and social isolation.',
    seedStatement: 'Good morning everyone. Today we are discussing Mobile Phones: their key advantages and disadvantages in modern daily life. Who would like to start?',
  },
];
