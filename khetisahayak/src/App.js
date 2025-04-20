import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./theme";

// Firebase imports
import { auth } from "./utils/firebase"; // path to your firebase.js
import { onAuthStateChanged } from "firebase/auth";

// Your component/page imports
import Preheader from "./components/Preheader";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import DashBoard from "./pages/DashBoard";
import Register from "./pages/Register";
import Search from "./pages/Search";
import ChatInterface from "./pages/ChatInterface";
import Blogs from "./pages/Blogs";
import CropPrediction from "./pages/CropPrediction";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user || null);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  console.log(user);

  return (
    <Router>
      <ThemeProvider theme={theme}>
        <Preheader />
        <Routes>
          <Route path="/" element={user ? <Home /> : <Navigate to="/auth" />} >
            <Route path="dashboard" element={<DashBoard />} />
            <Route path="register" element={<Register />} />
            <Route path="search" element={<Search />} />
            <Route path="asksahayak" element={<ChatInterface />} />
            <Route path="blog" element={<Blogs />} />
            <Route path="cropprediction" element={<CropPrediction />} />
          </Route>
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </ThemeProvider>
    </Router>
  );
};

export default App;
