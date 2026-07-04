# Database Seeding

This project uses a custom seeding script located in `src/convex/seed.ts`. This script is designed to provide a clean state with predictable sample data for development and testing.

## How to Run

To reset and seed the database, run the following command from the root directory:

```bash
bun run seed
```

> [!IMPORTANT]
> This command will **DELETE ALL DATA** currently in your Convex database before seeding. Use it only in development environments.

## Customizing Seed Data

All seed data is defined in static arrays at the top of `src/convex/seed.ts`.

### Linking Data

When adding data that depends on other tables, use the index of the parent item:

- `teacherIndices: [2]` refers to the third item in the `USERS` array.
- `sectionIndex: 0` refers to the first item in the `SECTIONS` array.
