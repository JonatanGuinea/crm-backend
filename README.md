# CRM Backend API

Multi-user CRM REST API built with Node.js, Express and MongoDB.

This project implements authentication with JWT, secure resource ownership and client–project relationships following a scalable backend architecture.

---

## 🚀 Features

- 🔐 JWT Authentication
- 👤 Multi-user architecture
- 🧑‍💼 Client management (CRUD)
- 📁 Project management (CRUD)
- 🔗 Client–Project relationship
- 🛡 Protected routes with middleware
- 📦 Standardized API responses
- 🗂 Modular folder structure

---

## 🛠 Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token (JWT)
- bcrypt

---

## 📂 Project Structure


src/
│
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── utils/
│
├── app.js
└── server.js


---

## 🔑 Authentication

The API uses JWT for authentication.

After login, include the token in requests:

Authorization: Bearer YOUR_TOKEN


---

## 📌 Example Endpoints

### Auth
- POST `/api/auth/register`
- POST `/api/auth/login`

### Clients
- GET `/api/clients`
- POST `/api/clients`
- GET `/api/clients/:id`

### Projects
- GET `/api/projects`
- POST `/api/projects`

---

## ⚙️ Installation

Clone the repository:

git clone https://github.com/your-username/crm-backend.git


Install dependencies:

npm install


Create a `.env` file based on `.env.example`:

PORT=8080
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key


Run the server:

npm run dev


---

## 📈 Future Improvements

- Project status pipeline
- Role-based access control
- Refresh tokens
- Pagination and filtering
- Unit testing

---

## 📄 License

MIT
