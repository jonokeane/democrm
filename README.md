# Jono CRM (demo)

A live demo of a custom client CRM: contacts and follow-ups, projects, time tracking, branded invoices with PDF download, deals, expenses and tax set-asides.

**Try it:** https://democrm.jonokeane.com

- Everything shown is sample data for a fictional business.
- There is no server. Anything a visitor adds or changes is saved only in their own browser, and **Reset demo data** puts the samples back.
- Email sending, Google Calendar sync, passwords and user management are turned off in the demo.

Built by [JonoKeane](https://jonokeane.com). Create a platform that matches your needs!

## How it's put together

Plain HTML, CSS and JavaScript with no build step. Vercel serves the `public/` folder as a static site.

- `public/index.html`: page layout and styles
- `public/app.js`: the app
- `public/demo-data.js`: the sample data, built relative to today's date so the demo always looks current
