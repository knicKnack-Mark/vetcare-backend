# VetCare Backend

Backend API for **VetCare**, a veterinary clinic management system designed to manage pets, pet owners, appointments, vaccinations, deworming records, and medical history.

## Tech Stack

* Node.js
* Express.js
* MongoDB
* Mongoose
* REST API

## Features

* Pet management
* Pet owner management
* Appointment scheduling
* Vaccination records
* Deworming records
* Anti-rabies records
* Medical history
* API authentication and authorization

## Project Structure

```text
vetcare-backend/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   └── server.js
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/vetcare-backend.git
cd vetcare-backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/vetcare
```

Start the development server:

```bash
npm run dev
```

The API will be available at:

```text
http://localhost:5000
```

## API

The backend provides RESTful APIs that will be consumed by the VetCare frontend.

Example:

```text
GET    /api/pets
POST   /api/pets
GET    /api/pets/:id
PUT    /api/pets/:id
DELETE /api/pets/:id
```

## Environment Variables

| Variable      | Description                 |
| ------------- | --------------------------- |
| `PORT`        | Port used by the API server |
| `MONGODB_URI` | MongoDB connection string   |

> Never commit your `.env` file or sensitive credentials to GitHub.

## Status

🚧 **In Development**

VetCare is currently under development. Features and API endpoints may change as the project evolves.

## License

This project is for personal and educational purposes.
