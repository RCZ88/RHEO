import type { MasteryLevel } from '../../shared/learn/types';

export interface CurriculumTrailer {
  what: string;
  why: string;
  where: string;
}

export interface CurriculumBranch {
  id: string;
  emoji: string;
  title: string;
  color: string;
  ord: number;
}

export const CURRICULUM_BRANCHES: CurriculumBranch[] = [
  { id: 'cs-ai',     emoji: '\uD83E\uDD16', title: 'Computer Science & AI',   color: 'clay',  ord: 0 },
  { id: 'languages', emoji: '\uD83D\uDDE3\uFE0F', title: 'Language Learning', color: 'sage',  ord: 1 },
  { id: 'music',     emoji: '\uD83C\uDFB5', title: 'Music Theory & Practice', color: 'amber', ord: 2 },
  { id: 'math',      emoji: '\u2211',  title: 'Mathematics',            color: 'sky',   ord: 3 },
];

export function getBranch(id: string): CurriculumBranch | undefined {
  return CURRICULUM_BRANCHES.find((b) => b.id === id);
}

export interface CurriculumTopic {
  part: number;
  slug: string;
  emoji: string;
  title: string;
  rarity: number;
  phase: 1 | 2 | 3;
  trailer: CurriculumTrailer;
  intro: string;
  defaultMasteryTarget: MasteryLevel;
  checklist: string[];
  branchId: string;
  parentSlug?: string;
  prereqSlugs?: string[];
}

export const CURRICULUM_TOPICS: CurriculumTopic[] = [
  {
    part: 0,
    branchId: 'cs-ai',
    slug: 'what-ai-engineers-do',
    emoji: '\uD83E\uDDED',
    title: 'What AI Engineers Actually Do',
    rarity: 3,
    phase: 1,
    trailer: {
      what: 'The real landscape of AI/ML roles and where the value actually lives.',
      why: 'Clears the myth so you aim at the right target before investing years.',
      where: 'Every \u201Cdoes this even need ML, and who owns it?\u201D decision.',
    },
    intro: 'The vast majority of AI/ML engineers make existing algorithms work reliably, cheaply, and at scale \u2014 ~90% of the value is the engineering around the model, not inventing new math.',
    defaultMasteryTarget: 'L2',
    checklist: [
      'Distinguish Research Scientist / ML Engineer / AI Engineer / Data Scientist / MLOps in one breath',
      'For any problem, decide first: does this even need ML, or is a heuristic better?',
      'Internalize that \u201Cdiscovery\u201D is the researcher\u2019s job; \u201Cmake it reliable, cheap, shipped\u201D is the engineer\u2019s',
      'Adopt the reliability / scalability / maintainability / adaptability mental model',
    ],
  },
  {
    part: 1,
    branchId: 'cs-ai',
    slug: 'cs-systems-foundations',
    emoji: '\uD83C\uDFDB\uFE0F',
    title: 'CS & Systems Foundations',
    rarity: 4,
    phase: 1,
    trailer: {
      what: 'How computers, languages, and networks actually work under the abstractions.',
      why: 'Every performance, reliability, and scaling decision traces back here.',
      where: 'Debugging the \u201Cimpossible\u201D bug and reasoning about behavior before running code.',
    },
    intro: 'The most senior engineers predict how a system behaves without running it. AI assistants hallucinate most at exactly this layer \u2014 so your depth here is a force multiplier.',
    defaultMasteryTarget: 'L3',
    checklist: [
      'Memory hierarchy & the machine \u2014 stack vs heap, cache lines/misses, RAM vs SSD vs disk latency',
      'How code runs \u2014 compilation vs interpretation, JIT, bytecode, GC; JVM vs CPython',
      'Concurrency & parallelism \u2014 threads/processes/async, race conditions, deadlocks, the GIL',
      'Networking \u2014 TCP/IP, HTTP/1.1 vs HTTP/2, the TLS handshake, DNS',
      'Operating systems \u2014 processes, scheduling, virtual memory, syscalls, file descriptors',
      'Complexity in practice \u2014 Big-O and constants; when O(n\u00B2) beats O(n log n) for small n',
      'Latency numbers every engineer should know',
    ],
  },
  {
    part: 2,
    branchId: 'cs-ai',
    slug: 'software-design-architecture',
    emoji: '\uD83C\uDFA8',
    title: 'Software Design & Architecture',
    rarity: 4,
    phase: 1,
    trailer: {
      what: 'Structuring code and systems so they stay changeable as they grow.',
      why: 'Code is read and changed 10\u00D7 more than written; bad architecture compounds into paralysis.',
      where: 'Every decision about modules, boundaries, and dependencies.',
    },
    intro: 'The graduate course on the OOP you already love. The most durable skill, because it is about taste and trade-offs, which AI imitates poorly.',
    defaultMasteryTarget: 'L3',
    checklist: [
      'Abstraction & API design \u2014 hide the right things; the cost of a leaky abstraction',
      'Coupling & cohesion \u2014 dependency direction, dependency inversion',
      'Design patterns \u2014 and when NOT to use them',
      'SOLID & composition over inheritance \u2014 the real lessons behind the buzzwords',
      'Domain modeling / DDD \u2014 model the problem, not the database table',
      'System design at scale \u2014 load balancing, caching, queues, CDNs, statelessness',
      'Distributed systems \u2014 CAP, eventual consistency, idempotency, retries/backoff, consensus',
      'Evolving large codebases \u2014 safe refactoring, strangler-fig migrations',
    ],
  },
  {
    part: 3,
    branchId: 'cs-ai',
    slug: 'performance-efficiency',
    emoji: '\u26A1',
    title: 'Performance & Efficiency',
    rarity: 5,
    phase: 2,
    trailer: {
      what: 'Making software fast and cheap \u2014 measured, not guessed.',
      why: 'Efficiency is the line between a tool that scales and one that dies under load; at AI scale it is literally dollars.',
      where: 'Hot loops, inference paths, data pipelines.',
    },
    intro: 'Genuinely rare, because most developers guess. Top engineers measure, then optimize only the thing that matters.',
    defaultMasteryTarget: 'L3',
    checklist: [
      'Measure first \u2014 profiling (CPU, memory, flame graphs), avoiding premature optimization',
      'Latency vs throughput, and tail latency (p50 vs p99) \u2014 why averages lie',
      'Algorithmic vs systems optimization \u2014 sometimes a better data structure wins',
      'Memory \u2014 allocation cost, object pooling, GC pressure, cache locality',
      'Data-oriented design \u2014 arrays over pointer-chasing for cache friendliness',
      'Throughput tricks \u2014 batching, pipelining, backpressure',
      'Lower-level levers \u2014 SIMD/vectorization; why NumPy & PyTorch are fast; row vs column layout',
      'The cost mindset \u2014 treat compute/memory/network as a budget',
    ],
  },
  {
    part: 4,
    branchId: 'cs-ai',
    slug: 'databases-deep',
    emoji: '\uD83D\uDDC4\uFE0F',
    title: 'Databases, Deep',
    rarity: 4,
    phase: 1,
    trailer: {
      what: 'How databases store, index, and protect data \u2014 and how to choose and use them well.',
      why: 'Almost every app is a thin layer over a database; the DB is usually the bottleneck and the risk.',
      where: 'Schema design, query tuning, scaling, and your RAG / vector work.',
    },
    intro: 'Knowing how the engine works (not just SQL syntax) is a classic senior differentiator.',
    defaultMasteryTarget: 'L3',
    checklist: [
      'Storage & indexes \u2014 B-trees vs LSM-trees, how an index speeds a query, write amplification',
      'Query planning \u2014 EXPLAIN, why a query is slow, the N+1 problem',
      'Transactions & ACID \u2014 isolation levels, MVCC, locking, deadlocks, anomalies',
      'Normalization vs denormalization \u2014 and when to break the rules',
      'Scaling \u2014 replication, partitioning/sharding, read replicas, connection pooling',
      'SQL vs NoSQL vs NewSQL \u2014 pick by access pattern, not hype',
      'Vector databases & embeddings \u2014 HNSW/IVF, similarity search (powers RAG)',
      'Caching \u2014 Redis patterns, and cache invalidation',
    ],
  },
  {
    part: 5,
    branchId: 'cs-ai',
    slug: 'security',
    emoji: '\uD83D\uDD10',
    title: 'Security (app + data + AI)',
    rarity: 5,
    phase: 1,
    trailer: {
      what: 'Building systems that resist attackers, and protecting data.',
      why: 'One breach can end a product; security is assumed of senior engineers but truly learned by few.',
      where: 'Auth, data handling, dependencies, and AI-specific attack surfaces.',
    },
    intro: 'A real years-of-experience domain, because it is an adversarial mindset \u2014 you must think like an attacker.',
    defaultMasteryTarget: 'L3',
    checklist: [
      'Threat modeling \u2014 STRIDE, attack surfaces, think like an attacker',
      'OWASP Top 10 \u2014 injection (SQLi), XSS, CSRF, SSRF, broken access control',
      'AuthN vs AuthZ \u2014 sessions, OAuth2/OIDC, JWT pitfalls, RBAC/ABAC',
      'Cryptography fundamentals \u2014 hashing vs encryption, salting (bcrypt/argon2), never roll your own',
      'Secrets management \u2014 vaults vs env vars, no secrets in repos, key rotation',
      'Supply-chain security \u2014 dependency audits, lockfiles, typosquatting, SBOMs',
      'AI/LLM security \u2014 direct & indirect prompt injection, data poisoning',
      'The lethal trifecta \u2014 untrusted input + private data + exfiltration path; guardrails',
    ],
  },
  {
    part: 6,
    branchId: 'cs-ai',
    slug: 'ml-dl-math-theory',
    emoji: '\u2797',
    title: 'ML/DL Math & Theory',
    rarity: 4,
    phase: 2,
    trailer: {
      what: 'The mathematics underneath learning algorithms.',
      why: 'Separates someone who calls model.fit() from someone who knows why it works and can invent.',
      where: 'Every model decision and every \u201Cwhy isn\u2019t this training\u201D moment.',
    },
    intro: 'You are already math-first (SVM Extended Essay, backprop by hand) \u2014 this is your moat. Deepen it.',
    defaultMasteryTarget: 'L4',
    checklist: [
      'Linear algebra (deep) \u2014 eigenvalues, SVD, why everything is matrix multiplication',
      'Calculus \u2014 gradients, chain rule, Jacobians \u2014 the math of backprop',
      'Probability & statistics \u2014 Bayes, MLE/MAP, expectation, variance',
      'Optimization \u2014 SGD/momentum/Adam, convex vs non-convex, loss landscapes',
      'Information theory \u2014 entropy, cross-entropy, KL divergence',
      'Generalization \u2014 bias-variance, regularization, inductive bias',
      'Architectures (conceptual) \u2014 MLP \u2192 CNN \u2192 RNN/LSTM \u2192 Transformer \u2192 diffusion',
      'The \u201Cwhy\u201D \u2014 why attention beat recurrence, why depth helps',
    ],
  },
  {
    part: 7,
    branchId: 'cs-ai',
    slug: 'pytorch-dl-engineering',
    emoji: '\uD83D\uDD25',
    title: 'PyTorch & DL Engineering',
    rarity: 5,
    phase: 1,
    trailer: {
      what: 'Mastery of the framework top AI builders live in \u2014 down to its internals.',
      why: 'The gap between following tutorials and debugging real training.',
      where: 'Every model you build, train, and ship (your Stage 3 frontier).',
    },
    intro: 'Principal-level PyTorch roles literally list these: autograd internals, distributed training, performance engineering. Aim there.',
    defaultMasteryTarget: 'L4',
    checklist: [
      'Tensors deeply \u2014 dtypes, devices, strides, views vs copies, broadcasting, contiguous memory',
      'Autograd internals \u2014 the dynamic graph, how .backward() walks it, custom autograd.Function',
      'nn.Module \u2014 custom layers/models, parameters vs buffers, the forward pass',
      'Training-loop mastery \u2014 optimizers, schedulers, gradient accumulation & clipping',
      'Data pipeline \u2014 Dataset/DataLoader, collation, avoiding the data-loading bottleneck',
      'Debugging training \u2014 exploding/vanishing gradients, NaNs, overfitting diagnosis',
      'Mixed precision (AMP), distributed training (DDP/FSDP, NCCL)',
      'Performance \u2014 torch.profiler, torch.compile, the dispatcher/ATen/CUDA path; inference optimization',
    ],
  },
  {
    part: 8,
    branchId: 'cs-ai',
    slug: 'applied-ai-llm-engineering',
    emoji: '\uD83E\uDD16',
    title: 'Applied AI / LLM Engineering',
    rarity: 4,
    phase: 2,
    trailer: {
      what: 'Building real products on top of models \u2014 the day-to-day of a modern AI Engineer.',
      why: 'This is the current job market and your product wedge.',
      where: 'Your DeskFlow / FM-AI agentic systems, RAG, and MCP work.',
    },
    intro: 'This is your home turf \u2014 formalize it into rare depth.',
    defaultMasteryTarget: 'L4',
    checklist: [
      'Prompt engineering as a discipline \u2014 few-shot, CoT, structured output, context-window management',
      'RAG done right \u2014 chunking, embeddings, retrieval, re-ranking, hybrid search; eval retrieval separately',
      'Agentic systems \u2014 tool calling, planning, memory, multi-agent, the recursion/parse loop, self-correction',
      'Fine-tuning vs RAG vs prompting \u2014 when each is right; LoRA/QLoRA, PEFT',
      'Evaluation & observability \u2014 eval sets, LLM-as-judge, regression testing, tracing',
      'Inference infrastructure \u2014 serving, batching, streaming, KV cache, vLLM, cost & latency',
      'Guardrails \u2014 output validation, safety, fallback strategies',
    ],
  },
  {
    part: 9,
    branchId: 'cs-ai',
    slug: 'mlops-production-ml',
    emoji: '\uD83D\uDEA2',
    title: 'MLOps & Production ML',
    rarity: 4,
    phase: 2,
    trailer: {
      what: 'Everything between \u201Cworks on my machine\u201D and \u201Creliable in production.\u201D',
      why: 'Models that aren\u2019t deployed, monitored, and reproducible are worthless.',
      where: 'Shipping and operating any ML feature.',
    },
    intro: 'This is where most ML projects die \u2014 own it.',
    defaultMasteryTarget: 'L3',
    checklist: [
      'Reproducibility \u2014 experiment tracking, seeds, data + model versioning',
      'Deployment patterns \u2014 batch vs real-time, REST/gRPC, shadow/canary/blue-green',
      'Monitoring \u2014 data drift, concept drift, model decay, alerting',
      'CI/CD for ML \u2014 automated testing of data and models, pipelines',
      'Containerization & infra \u2014 Docker, Kubernetes basics, one cloud, serverless inference',
      'Data engineering basics \u2014 ETL/ELT, feature stores, streaming vs batch, data quality',
    ],
  },
  {
    part: 10,
    branchId: 'cs-ai',
    slug: 'meta-skills',
    emoji: '\uD83E\uDDE0',
    title: 'The Meta-Skills',
    rarity: 5,
    phase: 3,
    trailer: {
      what: 'The non-code skills that compound over a career.',
      why: 'Two engineers with equal coding skill diverge entirely on these.',
      where: 'Everywhere \u2014 and exactly where AI can\u2019t replace you.',
    },
    intro: 'The top 1% are made here.',
    defaultMasteryTarget: 'L4',
    checklist: [
      'Debugging as a science \u2014 hypothesis \u2192 experiment \u2192 bisect; reproduce before fixing',
      'Reading source code & papers \u2014 go to the source; reimplement papers',
      'Knowing what NOT to build \u2014 scoping, saying no, the simplest thing that works',
      'Technical writing & communication \u2014 design docs, clear PRs, explaining trade-offs',
      'Taste & judgment \u2014 the aesthetic sense for good systems and UI',
      'Directing AI well \u2014 right context, fundamentals, verification loops, critical review',
    ],
  },
  {
    part: 11,
    branchId: 'cs-ai',
    slug: 'vision-multimodal-ai',
    emoji: '\uD83D\uDC41\uFE0F',
    title: 'Vision & Multimodal AI',
    rarity: 5,
    phase: 2,
    trailer: {
      what: 'How models turn pixels into meaning \u2014 accurately, cheaply, locally.',
      why: 'Multimodal is the live frontier; \u201Cdescribe an image well, cheaply, locally\u201D is a real product wedge.',
      where: 'Your local visual-critique engine and any DeskFlow feature reasoning over screenshots.',
    },
    intro: 'The model is commodity \u2014 the real engineering is the pipeline and the levers around it (your 6GB RTX 4050).',
    defaultMasteryTarget: 'L3',
    checklist: [
      'How a VLM sees \u2014 vision encoder \u2192 patch embeddings \u2192 projection into the LLM token space \u2192 decode',
      'Vision encoders deeply \u2014 ViT/CLIP/SigLIP, patches, why resolution & patch size bound perception',
      'OCR vs captioning vs grounding \u2014 route each sub-task to the right tool',
      'Lightweight local VLMs \u2014 Florence-2, Moondream, SmolVLM, Qwen2.5-VL; match model to task & VRAM',
      'The \u201Cmeasure, don\u2019t ask\u201D principle \u2014 compute colors/contrast/spacing deterministically; VLM only synthesizes',
      'Accuracy/efficiency levers \u2014 resolution & tiling, quantization per pass, constrained decoding, caching',
      'Local inference runtimes \u2014 llama.cpp/Ollama (GGUF), quant levels and their effect on fine detail',
      'Evaluating vision output \u2014 measuring hallucination rate; verify claims against measured ground truth',
    ],
  },
  {
    part: 12,
    branchId: 'cs-ai',
    slug: 'training-finetuning-adaptation',
    emoji: '\uD83D\uDEE0\uFE0F',
    title: 'Training, Fine-Tuning & Adaptation',
    rarity: 5,
    phase: 3,
    trailer: {
      what: 'The full spectrum of changing a model\u2019s behavior \u2014 from pretraining to inference-time steering.',
      why: 'Knowing which lever is feasible on your hardware is the gap between \u201CI can only prompt\u201D and \u201CI can make this model mine.\u201D',
      where: 'Specializing a small local model on a 6GB GPU.',
    },
    intro: 'Most of it does NOT require training from scratch. The craft is the cheapest intervention that produces the behavior you want.',
    defaultMasteryTarget: 'L3',
    checklist: [
      'The adaptation spectrum \u2014 pretraining \u2192 full FT \u2192 PEFT \u2192 inference-time steering \u2192 prompting/RAG',
      'What \u201Ctraining\u201D actually is \u2014 weights + gradients + optimizer states + activations (why it is memory-hungry)',
      'Hyperparameters & tuning \u2014 learning rate, batch size, schedulers, weight decay; grid/random/Bayesian',
      'PEFT \u2014 LoRA & QLoRA (feasible on 6GB!), adapters, prefix/prompt tuning; the math of low-rank updates',
      'Memory-saving tricks \u2014 gradient checkpointing/accumulation, mixed precision, 4-bit base',
      'Compressing/editing the model \u2014 quantization (PTQ/QAT), pruning, distillation, merging',
      'Data \u2014 the real bottleneck; curation, synthetic data, why quality beats size',
      'Inference-time steering & evaluation \u2014 when tuning inputs beats touching weights; catastrophic forgetting',
    ],
  },
];

export function getTopic(part: number, branchId?: string): CurriculumTopic | undefined {
  if (branchId != null) {
    return CURRICULUM_TOPICS.find((t) => t.part === part && t.branchId === branchId);
  }
  return CURRICULUM_TOPICS.find((t) => t.part === part);
}

export function getTopicBySlug(slug: string): CurriculumTopic | undefined {
  return CURRICULUM_TOPICS.find((t) => t.slug === slug);
}

export function getTopicsByBranch(branchId: string): CurriculumTopic[] {
  return CURRICULUM_TOPICS.filter((t) => t.branchId === branchId).sort((a, b) => a.part - b.part);
}

export function getTopicChildren(parentSlug: string): CurriculumTopic[] {
  return CURRICULUM_TOPICS.filter((t) => t.parentSlug === parentSlug).sort((a, b) => a.part - b.part);
}

export function rarityStars(rarity: number): string {
  return '\u2605'.repeat(Math.max(0, Math.min(5, rarity)));
}
