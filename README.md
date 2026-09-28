# ONMED – Online Doctor Consultation Platform

ONMED connects patients and doctors online. Patients can book appointments, and once a doctor confirms, the consultation time is fixed. At that time a video-call room is created so the patient and doctor can consult face to face.

## Features
- Patients can book appointments with doctors
- Doctors can confirm appointments, which fixes the consultation time
- A video-call room is created for the scheduled appointment
- Secure login using JWT authentication and password hashing (bcrypt)
- MongoDB database for storing users and appointments

## Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** MongoDB, Mongoose
- **Real-time / Video:** Socket.io
- **Authentication:** JWT, bcrypt

## Project Structure
- `server.js` – main server file
- `routes/` – API routes
- `models/` – Mongoose schemas
- `middleware/` – authentication and other middleware
- `public/` – frontend files
- `video/` – video call files

## How to Run Locally
1. Clone the repository
```
   git clone https://github.com/guptavicky2409/ONMED.git
   cd ONMED
```
2. Install dependencies
```
   npm install
```
3. Create a `.env` file in the root folder and add your own values, such as your MongoDB connection string and JWT secret (use the variable names your code expects)
4. Start the server
```
   npm start
```

## Author
Dhruv Gupta – [LinkedIn](https://www.linkedin.com/in/dhruv-gupta-8b9406370)