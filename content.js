/**
 * Portfolio newspaper content — single source of truth for all 5 newspapers.
 * Matches the reference design:
 *   - Landscape sheet (about 3:2)
 *   - Header band: small masthead ("THE DAILY CHRONICLE" + tagline), SECTION NAME, VOL. XII · NO. 0X
 *   - Huge bold serif headline (Playfair Display), italic subheading, italic pull quote on the right
 *   - Body grid of numbered story boxes (01, 02, 03... in dark circles) with headings, paragraphs, and framed photos with italic captions
 *   - Right-hand side panel (timeline, honors, positions of responsibility, brief list, glance)
 *   - Footer line of three uppercase words separated by diamonds/plus signs
 *
 * Used by:
 *   1. 3D WebGL Canvas texture renderer in newspaper.js
 *   2. HTML Reading View overlay in index.html / main.js (full text selectable & copyable)
 */

export const PORTFOLIO_NEWSPAPERS = [
  {
    id: 'education',
    sectionName: 'EDUCATION',
    masthead: 'THE DAILY CHRONICLE',
    mastheadTagline: 'Real Stories. Brighter Tomorrows.',
    issueNo: 'VOL. 12 · NO. 01',
    headline: 'From Curious Beginnings to a Future in Focus',
    subhead: 'A journey of learning, growth and new dreams',
    pullQuote: '“Education is not just about degrees, it’s about building a better version of yourself.”',
    boxes: [
      {
        num: '01',
        title: 'EARLY YEARS',
        subtitle: 'Pre-KG · Zenith educare club (pre School & abacus school)',
        paragraph: 'Every great journey begins with curiosity. In these early classrooms, the foundational joy of learning, numbers, and puzzles took root.',
        image: '/images/zenith-school.jpg',
        caption: 'Small steps, big dreams.'
      },
      {
        num: '02',
        title: 'SCHOOL YEARS',
        subtitle: 'LKG – 12th · St. Joseph Anglo-Indian Girls Higher Secondary School',
        paragraph: 'From formative schooling through higher secondary, rigorous academics, discipline, and dedicated mentorship shaped character and scientific curiosity.',
        image: '/images/st-joseph-school.jpg',
        caption: 'A place that shaped my tomorrow.'
      },
      {
        num: '03',
        title: 'ACADEMIC MILESTONES',
        subtitle: '10th & 12th Standard Milestones',
        paragraph: 'Milestone examinations that taught discipline, perseverance, and analytical focus, establishing habits that underpin every engineering challenge.',
        image: '/images/notebook.jpg',
        caption: 'More effort. Bigger dreams.'
      },
      {
        num: '04',
        title: 'UNDERGRADUATION',
        subtitle: 'B.Sc. Computer Science · Holy Cross College (2021–2024)',
        paragraph: 'Immersed in computational foundations: algorithms, data structures, relational databases, and software engineering, graduating with consistent distinction.',
        image: '/images/holy-cross-college.jpg',
        caption: 'Learning beyond the classroom.'
      },
      {
        num: '05',
        title: 'POSTGRADUATION',
        subtitle: 'MCA · Jamal Mohamed College (2024–2026)',
        paragraph: 'Advanced postgraduate curriculum specializing in distributed enterprise architectures, AI recommendations, data systems, and full-stack software development.',
        image: '/images/jamal-mohamed-college.jpg',
        caption: 'On to the next chapter.'
      }
    ],
    sidePanel: {
      title: 'SAME GIRL, BIGGER DREAMS',
      type: 'timeline',
      timeline: [
        { label: 'Pre-KG', detail: 'Zenith School' },
        { label: 'LKG – 12th', detail: 'St. Joseph Anglo-Indian Girls HSS' },
        { label: '10th & 12th', detail: 'Secondary & Higher Secondary' },
        { label: 'B.Sc. CS', detail: 'Holy Cross College (2021–2024)' },
        { label: 'MCA', detail: 'Jamal Mohamed College (2024–2026)' }
      ],
      honorsTitle: 'HONORS COLUMN',
      honors: [
        { prize: '1st Prize', event: 'Cyberfest’24 Paper Presentation' },
        { prize: '1st Prize', event: 'National Science Day 2025' },
        { prize: '2nd Prize', event: 'Cyberfest 2023' },
        { prize: '2nd Prize', event: 'Ruby Tech 2K24' }
      ]
    },
    footerWords: ['LEARN', 'GROW', 'ACHIEVE']
  },
  {
    id: 'experience',
    sectionName: 'EXPERIENCE',
    masthead: 'THE DAILY CHRONICLE',
    mastheadTagline: 'Real Stories. Brighter Tomorrows.',
    issueNo: 'VOL. 12 · NO. 02',
    headline: 'Dispatches from the Production Line: Code, Data & Design',
    subhead: 'Five practical internships spanning UI/UX design, predictive AI, Python, web systems, and operations',
    pullQuote: '“True engineering is an artisan’s craft: designed with empathy, deployed with precision.”',
    boxes: [
      {
        num: '01',
        title: 'UI/UX DESIGN INTERN',
        subtitle: 'iStudio · May–Jun 2025',
        paragraph: 'Practical experience in user-focused digital design, wireframing workflows, responsive design systems, and intuitive user experiences.',
        image: '/images/istudio.jpg',
        caption: 'Crafting user-focused digital experiences.'
      },
      {
        num: '02',
        title: 'DATA SCIENCE INTERN',
        subtitle: 'VCodez · Feb–Apr 2026',
        paragraph: 'Built Smart Furniture Recommender & Virtual Design Assistant using data analysis and artificial intelligence recommendation pipelines.',
        image: '/images/vcodez.jpg',
        caption: 'Data analysis and AI recommendations.'
      },
      {
        num: '03',
        title: 'PYTHON PROGRAMMING INTERN',
        subtitle: 'Witspire · Dec 2023–Jan 2024',
        paragraph: 'Completed an intensive 30-hour technical internship strengthening core Python programming, data structures, and script automation.',
        image: '/images/witspire.jpg',
        caption: 'Core Python mastery and data logic.'
      },
      {
        num: '04',
        title: 'WEB DEVELOPMENT INTERN',
        subtitle: 'e-soft IT Solutions · Jul 2023',
        paragraph: 'Built modern web components and frontend modules, earning a 100% performance and attendance evaluation from project leadership.',
        image: '/images/esoft.jpg',
        caption: '100% performance and attendance merit.'
      },
      {
        num: '05',
        title: 'HR INTERN (OPERATIONS)',
        subtitle: 'VDart · Jul–Oct 2023',
        paragraph: 'Supported daily operations and corporate performance management frameworks, coordinating key performance records and team workflows.',
        image: '/images/vdart.jpg',
        caption: 'Supporting performance management and operations.'
      }
    ],
    sidePanel: {
      title: 'POSITIONS OF RESPONSIBILITY',
      type: 'leadership',
      items: [
        { role: 'MC Committee Head', org: 'ITConnect 2K24 & 2K25 · Jamal Mohamed College' },
        { role: 'HCIICT-YUKTI Coordinator', org: 'Holy Cross College (2023–24)' },
        { role: 'IIC Member', org: 'Holy Cross College' },
        { role: 'Student Volunteer', org: 'Jamal Expo 2025' }
      ]
    },
    footerWords: ['DESIGN', 'CODE', 'DELIVER']
  },
  {
    id: 'projects',
    sectionName: 'PROJECTS',
    masthead: 'THE DAILY CHRONICLE',
    mastheadTagline: 'Real Stories. Brighter Tomorrows.',
    issueNo: 'VOL. 12 · NO. 03',
    headline: 'Digital Answer Sheet Research Presented at ICAC 2026',
    subhead: 'Automated evaluation models, intelligent recommendation engines, and full-stack digital architectures',
    pullQuote: '“Every project is an investigative headline into computational efficiency and real-world impact.”',
    boxes: [
      {
        num: '01',
        title: 'DIGITAL ANSWER SHEET EVALUATION',
        subtitle: 'Research Paper Presented at ICAC 2026',
        paragraph: 'Engineered an automated answer-sheet evaluation system for error-free grading; research paper was formally accepted and presented at an international conference.',
        image: '/images/answer-sheet.jpg',
        caption: 'Lead research: Automated error-free grading.'
      },
      {
        num: '02',
        title: 'SMART FURNITURE RECOMMENDER',
        subtitle: 'Virtual Design Assistant · 2026',
        paragraph: 'A Python recommendation solution utilizing data analysis and AI models to generate intelligent interior design suggestions.',
        image: '/images/smart-furniture.jpg',
        caption: 'Data analysis and AI recommendation engine.'
      },
      {
        num: '03',
        title: 'BRIDALCONNECT PLATFORM',
        subtitle: 'Independent Web Platform & UI/UX · 2026',
        paragraph: 'Web platform connecting brides with makeup artists, built end-to-end with responsive front-end development and dedicated UI/UX design.',
        image: '/images/bridal-connect.jpg',
        caption: 'Connecting brides with makeup artists.'
      }
    ],
    sidePanel: {
      title: 'IN BRIEF',
      type: 'brief',
      items: [
        {
          heading: 'Solutions Architecture Job Simulation',
          detail: 'Forage (2025) · Simple, scalable hosting architecture.'
        },
        {
          heading: 'Cryptocurrency Development Using Python',
          detail: '2024 · Digital currency, transaction processing, blockchain concepts.'
        },
        {
          heading: 'GLOW Water-Conservation',
          detail: '2022–2024 · Startup concept and prototype recycling washing-machine rinse water.'
        },
        {
          heading: 'Grocery App UI/UX Design',
          detail: 'Figma · Static grocery app interface practising layout, typography, colour, spacing, and hierarchy.'
        }
      ]
    },
    footerWords: ['RESEARCH', 'BUILD', 'SCALE']
  },
  {
    id: 'about',
    sectionName: 'ABOUT',
    masthead: 'THE DAILY CHRONICLE',
    mastheadTagline: 'Real Stories. Brighter Tomorrows.',
    issueNo: 'VOL. 12 · NO. 04',
    headline: 'Nashrin Fathima B.: A Versatile Technologist with a Communicator’s Voice',
    subhead: 'Bridging computational discipline, human stories, and dynamic operational leadership',
    pullQuote: '“I build where computational discipline, data systems, and human stories meet.”',
    boxes: [
      {
        num: '01',
        title: 'EDITORIAL DOSSIER',
        subtitle: 'Nashrin Fathima B. · MCA Graduate',
        paragraph: 'I am an MCA graduate with a versatile technical foundation across Python, web development, UI/UX design, data analysis, and cloud/solutions architecture fundamentals, combined with strong communication, leadership, and operations skills.',
        image: '/images/portrait.jpg',
        caption: 'Nashrin Fathima B. · Tiruchirappalli, Tamil Nadu.'
      },
      {
        num: '02',
        title: 'VISION & COMMITMENT',
        subtitle: 'Technical & Business-Support Versatility',
        paragraph: 'Eager to contribute across technical and business-support roles, bringing systematic discipline, proactive communication, and positive team energy to grow within a dynamic organization.',
        image: '/images/notebook.jpg',
        caption: 'Disciplined execution and continuous growth.'
      }
    ],
    sidePanel: {
      title: 'AT A GLANCE',
      type: 'glance',
      items: [
        { label: 'Languages', value: 'English, Tamil' },
        { label: 'Location', value: 'Tiruchirappalli, Tamil Nadu' },
        { label: 'Postgraduate', value: 'MCA · Jamal Mohamed College' },
        { label: 'Undergraduate', value: 'B.Sc. CS · Holy Cross College' }
      ]
    },
    contactStrip: {
      email: 'nashrininfo3@gmail.com',
      linkedin: 'https://linkedin.com/in/nashrin-fathima-488014234',
      linkedinText: 'linkedin.com/in/nashrin-fathima-488014234'
    },
    footerWords: ['PASSION', 'PURPOSE', 'IMPACT']
  },
  {
    id: 'skills',
    sectionName: 'SKILLS & TOOLKIT',
    masthead: 'THE DAILY CHRONICLE',
    mastheadTagline: 'Real Stories. Brighter Tomorrows.',
    issueNo: 'VOL. 12 · NO. 05',
    headline: 'What’s in the Toolkit: Technical Craft Meets Professional Strength',
    subhead: 'An architectural audit of developer tools, modern workflows, and interpersonal leadership',
    pullQuote: '“Tools evolve rapidly; foundational problem-solving and clear communication endure.”',
    boxes: [
      {
        num: '01',
        title: 'TECHNICAL DISCIPLINES',
        subtitle: 'Systems, Design, Code & Cloud Fundamentals',
        paragraph: 'Hands-on proficiencies applying programming languages, data pipelines, modern interface tooling, and scalable architectural patterns without fabricated percentage scores.',
        list: [
          'Python',
          'Web Development',
          'UI/UX Design',
          'Figma',
          'Data Analysis',
          'Blockchain Fundamentals',
          'Cloud & Solutions Architecture'
        ],
        image: '/images/notebook.jpg',
        caption: 'Engineering & digital design toolchain.'
      },
      {
        num: '02',
        title: 'PROFESSIONAL CAPABILITIES',
        subtitle: 'Leadership, Stage Presence & Operational Stewardship',
        paragraph: 'Demonstrated strengths commanding stages, coordinating multi-tier campus conventions, and supporting structured organizational operations.',
        list: [
          'Communication',
          'Public Speaking & Hosting',
          'Team Leadership',
          'Event Coordination',
          'Performance Management',
          'Operations Management',
          'Compensation Management'
        ],
        image: '/images/st-joseph-school.jpg',
        caption: 'Team orchestration and leadership proficiencies.'
      }
    ],
    sidePanel: {
      title: 'CORE PILLARS',
      type: 'pillars',
      items: [
        { title: 'Computational Discipline', desc: 'Rigorous algorithmic logic and clean, maintainable structure.' },
        { title: 'Human-Centered Design', desc: 'Empathy for user journeys, visual balance, and typography.' },
        { title: 'Operational Stewardship', desc: 'Clear communication, event leadership, and reliable execution.' }
      ]
    },
    footerWords: ['CRAFT', 'MASTERY', 'LEADERSHIP']
  }
];

/**
 * Escape text for safe semantic HTML injection
 */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/**
 * Generate semantic, accessible, fully-selectable HTML for the Reading View.
 * Matches the reference layout:
 *   - Masthead banner with section name and issue
 *   - Big Playfair headline, italic subhead, pull quote
 *   - Grid of numbered story boxes with framed photo slots & italic captions
 *   - Right side panel (timeline, honors, brief items, or glance)
 *   - Contact strip (for About) with real clickable mailto and https links
 *   - Footer with three uppercase words separated by diamonds
 */
export function renderReadingViewHTML(paper) {
  if (!paper) return '';

  // Render Story Boxes
  const boxesHTML = (paper.boxes || []).map((b) => {
    const listHTML = b.list
      ? `<ul class="rv-box-list">${b.list.map((item) => `<li><span class="rv-bullet">◆</span><span>${esc(item)}</span></li>`).join('')}</ul>`
      : '';

    return `
      <article class="rv-box">
        <div class="rv-box-header">
          <span class="rv-box-num">${esc(b.num)}</span>
          <div class="rv-box-titles">
            <h3 class="rv-box-title">${esc(b.title)}</h3>
            <p class="rv-box-subtitle">${esc(b.subtitle)}</p>
          </div>
        </div>
        <p class="rv-box-p">${esc(b.paragraph)}</p>
        ${listHTML}
        <figure class="rv-photo-frame">
          <img class="rv-photo" src="${esc(b.image)}" alt="${esc(b.title)}" loading="lazy" onerror="this.onerror=null; this.classList.add('is-missing'); this.style.display='none'; this.nextElementSibling.classList.add('show-placeholder');">
          <div class="rv-photo-placeholder" aria-hidden="true">
            <div class="rv-placeholder-etching">
              <span class="rv-etch-icon">✦</span>
              <span class="rv-etch-label">${esc(b.title)}</span>
            </div>
          </div>
          <figcaption class="rv-photo-caption">${esc(b.caption)}</figcaption>
        </figure>
      </article>
    `;
  }).join('');

  // Render Side Panel
  let sidePanelHTML = '';
  if (paper.sidePanel) {
    const sp = paper.sidePanel;
    let content = '';

    if (sp.type === 'timeline') {
      const items = (sp.timeline || []).map((t, idx, arr) => `
        <li class="rv-timeline-step">
          <div class="rv-step-marker">●</div>
          <div class="rv-step-body">
            <strong class="rv-step-label">${esc(t.label)}</strong>
            <span class="rv-step-detail">${esc(t.detail)}</span>
          </div>
          ${idx < arr.length - 1 ? '<div class="rv-step-arrow">↓</div>' : ''}
        </li>
      `).join('');

      let honorsHTML = '';
      if (sp.honors && sp.honors.length) {
        const hItems = sp.honors.map((h) => `
          <li class="rv-honor-item">
            <strong class="rv-honor-prize">${esc(h.prize)}</strong>
            <span class="rv-honor-event">${esc(h.event)}</span>
          </li>
        `).join('');
        honorsHTML = `
          <div class="rv-side-subbox">
            <h4 class="rv-side-subtitle">${esc(sp.honorsTitle || 'HONORS')}</h4>
            <ul class="rv-honors-list">${hItems}</ul>
          </div>
        `;
      }

      content = `
        <ul class="rv-timeline-list">${items}</ul>
        ${honorsHTML}
      `;
    } else if (sp.type === 'leadership') {
      const items = (sp.items || []).map((it) => `
        <li class="rv-lead-item">
          <strong class="rv-lead-role">${esc(it.role)}</strong>
          <span class="rv-lead-org">${esc(it.org)}</span>
        </li>
      `).join('');
      content = `<ul class="rv-lead-list">${items}</ul>`;
    } else if (sp.type === 'brief') {
      const items = (sp.items || []).map((it) => `
        <li class="rv-brief-item">
          <strong class="rv-brief-head">${esc(it.heading)}</strong>
          <span class="rv-brief-desc">${esc(it.detail)}</span>
        </li>
      `).join('');
      content = `<ul class="rv-brief-list">${items}</ul>`;
    } else if (sp.type === 'glance') {
      const items = (sp.items || []).map((it) => `
        <li class="rv-glance-item">
          <span class="rv-glance-label">${esc(it.label)}</span>
          <strong class="rv-glance-value">${esc(it.value)}</strong>
        </li>
      `).join('');
      content = `<ul class="rv-glance-list">${items}</ul>`;
    } else if (sp.type === 'pillars') {
      const items = (sp.items || []).map((it) => `
        <li class="rv-pillar-item">
          <strong class="rv-pillar-title">${esc(it.title)}</strong>
          <span class="rv-pillar-desc">${esc(it.desc)}</span>
        </li>
      `).join('');
      content = `<ul class="rv-pillar-list">${items}</ul>`;
    }

    sidePanelHTML = `
      <aside class="rv-side-panel">
        <h4 class="rv-side-title">${esc(sp.title)}</h4>
        <div class="rv-side-rule"></div>
        <div class="rv-side-content">${content}</div>
      </aside>
    `;
  }

  // Contact Strip (About section)
  let contactStripHTML = '';
  if (paper.contactStrip) {
    const cs = paper.contactStrip;
    contactStripHTML = `
      <div class="rv-contact-strip">
        <div class="rv-contact-inner">
          <span class="rv-contact-tag">EDITORIAL CONTACT & CORRESPONDENCE:</span>
          <a class="rv-contact-link" href="mailto:${esc(cs.email)}" aria-label="Send email to Nashrin Fathima">
            <span class="rv-link-icon">✉</span> ${esc(cs.email)}
          </a>
          <span class="rv-contact-sep">·</span>
          <a class="rv-contact-link" href="${esc(cs.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="Open Nashrin Fathima's LinkedIn profile">
            <span class="rv-link-icon">↗</span> ${esc(cs.linkedinText)}
          </a>
        </div>
      </div>
    `;
  }

  // Footer words
  const footerWordsHTML = (paper.footerWords || ['LEARN', 'GROW', 'ACHIEVE'])
    .map((w) => `<span class="rv-footer-word">${esc(w)}</span>`)
    .join('<span class="rv-footer-sep">◆</span>');

  return `
    <article class="rv-paper" data-section="${esc(paper.id)}">
      <!-- Outer Oxford Borders -->
      <div class="rv-border-outer"></div>
      <div class="rv-border-inner"></div>

      <!-- Top Header Band -->
      <header class="rv-header-band">
        <div class="rv-masthead-left">
          <h2 class="rv-masthead-name">${esc(paper.masthead)}</h2>
          <p class="rv-masthead-tagline">${esc(paper.mastheadTagline)}</p>
        </div>
        <div class="rv-masthead-center">
          <span class="rv-header-rule"></span>
          <h1 class="rv-section-label">${esc(paper.sectionName)}</h1>
          <span class="rv-header-rule"></span>
        </div>
        <div class="rv-masthead-right">
          <span class="rv-issue-no">${esc(paper.issueNo)}</span>
        </div>
      </header>

      <!-- Oxford Header Separator Rule -->
      <div class="rv-rule-double"></div>

      <!-- Hero Headline & Pull Quote -->
      <div class="rv-headline-row">
        <div class="rv-headline-block">
          <h2 class="rv-main-headline">${esc(paper.headline)}</h2>
          <p class="rv-main-subhead">${esc(paper.subhead)}</p>
        </div>
        <blockquote class="rv-pull-quote">
          <p class="rv-quote-text">${esc(paper.pullQuote)}</p>
        </blockquote>
      </div>

      <!-- Mid Thin Separator -->
      <div class="rv-rule-thin"></div>

      <!-- Main Body: Story Boxes Grid + Side Panel -->
      <div class="rv-body-grid">
        <section class="rv-boxes-flow" aria-label="${esc(paper.sectionName)} Stories">
          ${boxesHTML}
        </section>
        ${sidePanelHTML}
      </div>

      <!-- Optional Contact Strip (About section) -->
      ${contactStripHTML}

      <!-- Bottom Oxford Rule -->
      <div class="rv-rule-double rv-rule-footer"></div>

      <!-- Footer Band -->
      <footer class="rv-footer-band">
        <div class="rv-footer-diamonds">${footerWordsHTML}</div>
      </footer>
    </article>
  `;
}
