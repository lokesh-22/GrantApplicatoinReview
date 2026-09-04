import { PrismaClient, Role, ApplicationStatus, ReviewStatus, TimelineEventType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Prisma seeding...');

  // Clean existing data in order of dependencies
  await prisma.alertDismissal.deleteMany({});
  await prisma.timelineEvent.deleteMany({});
  await prisma.conflictOfInterest.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create 3 Program Officers
  const programOfficers = [];
  const poData = [
    { name: 'Alice Morgan', email: 'alice.morgan@grantreview.gov' },
    { name: 'Bob Vance', email: 'bob.vance@grantreview.gov' },
    { name: 'Carol Danvers', email: 'carol.danvers@grantreview.gov' },
  ];

  for (const po of poData) {
    const user = await prisma.user.create({
      data: {
        name: po.name,
        email: po.email,
        passwordHash,
        role: Role.PROGRAM_OFFICER,
      },
    });
    programOfficers.push(user);
  }

  // 2. Create 8 Reviewers
  const reviewers = [];
  const reviewerData = [
    { name: 'Dr. David Smith', email: 'david.smith@university.edu' },
    { name: 'Dr. Elena Rostova', email: 'elena.rostova@research.org' },
    { name: 'Frank Miller', email: 'frank.miller@techfund.org' },
    { name: 'Grace Hopper', email: 'grace.hopper@cs.org' },
    { name: 'Henry Ford', email: 'henry.ford@innovation.org' },
    { name: 'Irene Adler', email: 'irene.adler@detective.org' },
    { name: 'Jack Shepard', email: 'jack.shepard@health.org' },
    { name: 'Karen Page', email: 'karen.page@justice.org' },
  ];

  for (const r of reviewerData) {
    const user = await prisma.user.create({
      data: {
        name: r.name,
        email: r.email,
        passwordHash,
        role: Role.REVIEWER,
      },
    });
    reviewers.push(user);
  }

  console.log('\n======================================================');
  console.log('🔑 DEMO USER CREDENTIALS (ALL USERS SHARE PASSWORD: password123)');
  console.log('======================================================');
  console.log('PROGRAM OFFICERS:');
  programOfficers.forEach(po => console.log(` - ${po.name} (${po.email}) | Password: password123`));
  console.log('\nREVIEWERS:');
  reviewers.forEach(r => console.log(` - ${r.name} (${r.email}) | Password: password123`));
  console.log('======================================================\n');

  // 3. Create ~40 Applications across 3 funding rounds
  const fundingRounds = ['FY2024-Q1 Tech Innovation', 'FY2024-Q2 Health & Bio', 'FY2024-Q3 Climate Resilience'];
  const orgPrefixes = ['Apex', 'BioGen', 'CleanTech', 'DataVentures', 'EcoSphere', 'FutureLabs', 'GreenGen', 'Hyperion', 'InnoWave', 'QuantumCore'];
  const orgSuffixes = ['Institute', 'Labs', 'Solutions', 'Foundation', 'Technologies', 'Research', 'Dynamics', 'Systems'];
  const statuses = [ApplicationStatus.SUBMITTED, ApplicationStatus.ASSIGNED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.DECIDED];

  const createdApplications = [];

  for (let i = 1; i <= 40; i++) {
    const org = `${orgPrefixes[i % orgPrefixes.length]} ${orgSuffixes[i % orgSuffixes.length]}`;
    const round = fundingRounds[i % fundingRounds.length];
    const poOwner = programOfficers[i % programOfficers.length];
    const status = statuses[i % statuses.length];
    const amount = (15000 + (i * 12500)).toFixed(2);
    
    // Dates spread out across recent past
    const daysAgo = Math.floor(Math.random() * 60) + 1;
    const submissionDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const app = await prisma.application.create({
      data: {
        orgName: org,
        contactEmail: `contact@${org.toLowerCase().replace(/\s+/g, '')}.org`,
        fundingRound: round,
        amountRequested: amount,
        submissionDate,
        ownerId: poOwner.id,
        status,
        archived: i % 15 === 0, // a couple archived apps
      },
    });

    // Create Initial CREATED timeline event
    await prisma.timelineEvent.create({
      data: {
        applicationId: app.id,
        type: TimelineEventType.CREATED,
        actorId: poOwner.id,
        note: `Application submitted by ${org}`,
        createdAt: submissionDate,
      },
    });

    createdApplications.push(app);
  }

  // 4. Assignments & Reviews & Conflicts & Overdue items
  const now = new Date();
  const pastDueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago (Overdue)
  const futureDueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days in future

  let assignmentCount = 0;
  let reviewCount = 0;
  let conflictCount = 0;
  let overdueCount = 0;

  for (let i = 0; i < createdApplications.length; i++) {
    const app = createdApplications[i];

    // For applications in ASSIGNED, UNDER_REVIEW, or DECIDED state, create assignments
    if (app.status !== ApplicationStatus.SUBMITTED) {
      const assignedReviewers = [reviewers[i % reviewers.length], reviewers[(i + 1) % reviewers.length]];

      for (let j = 0; j < assignedReviewers.length; j++) {
        const reviewer = assignedReviewers[j];

        // Let's make every 10th application have a Conflict of Interest for reviewer
        if ((i + j) % 10 === 3 && conflictCount < 4) {
          await prisma.conflictOfInterest.create({
            data: {
              applicationId: app.id,
              reviewerId: reviewer.id,
              reason: `Reviewer served as an advisor for ${app.orgName} in 2023.`,
            },
          });
          conflictCount++;
          continue; // Don't assign if conflict
        }

        // Determine due date (make some overdue)
        const isOverdueTarget = (i % 6 === 0) && (j === 0);
        const dueDate = isOverdueTarget ? pastDueDate : futureDueDate;
        if (isOverdueTarget) overdueCount++;

        const assignment = await prisma.assignment.create({
          data: {
            applicationId: app.id,
            reviewerId: reviewer.id,
            dueDate,
          },
        });
        assignmentCount++;

        // Create ASSIGNED Timeline Event
        await prisma.timelineEvent.create({
          data: {
            applicationId: app.id,
            type: TimelineEventType.ASSIGNED,
            actorId: app.ownerId,
            newValue: reviewer.name,
            note: `Assigned reviewer ${reviewer.name}`,
          },
        });

        // Add reviews: if DECIDED or UNDER_REVIEW (some completed, some draft, overdue left incomplete)
        if (app.status === ApplicationStatus.DECIDED || (app.status === ApplicationStatus.UNDER_REVIEW && !isOverdueTarget)) {
          const isCompleted = app.status === ApplicationStatus.DECIDED || j === 0;
          
          await prisma.review.create({
            data: {
              applicationId: app.id,
              reviewerId: reviewer.id,
              assignmentId: assignment.id,
              impactScore: isCompleted ? 4 + (i % 2) : 3,
              feasibilityScore: isCompleted ? 3 + (i % 3) : null,
              budgetScore: isCompleted ? 4 : null,
              comments: isCompleted
                ? 'Strong methodology and clear team expertise. Highly recommend funding.'
                : 'Initial draft saved. Needs further evaluation on financial projections.',
              status: isCompleted ? ReviewStatus.COMPLETED : ReviewStatus.DRAFT,
              completedAt: isCompleted ? new Date() : null,
            },
          });
          reviewCount++;
        }

        // Create an alert dismissal example for one of the assignments
        if (i === 0 && j === 0) {
          await prisma.alertDismissal.create({
            data: {
              assignmentId: assignment.id,
              dismissedByUserId: reviewer.id,
              dueDateAtDismissal: dueDate,
            },
          });
        }
      }
    }
  }

  console.log(`✅ Seeded successfully:`);
  console.log(` - ${programOfficers.length} Program Officers`);
  console.log(` - ${reviewers.length} Reviewers`);
  console.log(` - ${createdApplications.length} Applications`);
  console.log(` - ${assignmentCount} Assignments (${overdueCount} overdue)`);
  console.log(` - ${reviewCount} Reviews`);
  console.log(` - ${conflictCount} Conflicts of Interest`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
