import React from "react";
import { auth, provider } from "../utils/firebase"; // Replace with your firebase.js path
import { signInWithPopup } from "firebase/auth";
import { Typography, Box, Container, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
const Auth = () => {
  const navigate = useNavigate();
  const signInWithGoogle = async () => {
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("User signed in:", user);
      navigate("/");
      // You can redirect or save user info here
    } catch (error) {
      console.error("Error signing in with Google:", error.message);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "linear-gradient(to right, #f0e68c, #d2b97f)",
        textAlign: "center",
        padding: "20px",
      }}
    >
      <Container maxWidth="sm">
        <Typography variant="h3" sx={{ fontWeight: 'bold', color: "#fff", marginBottom: "20px" }}>
          Welcome to KhetiSahayak.com
        </Typography>

        <Typography variant="h6" sx={{ color: "#fff", marginBottom: "30px" }}>
          A platform to support farmers with crop insights, equipment rentals, and more.
        </Typography>

        <Button
          onClick={signInWithGoogle}
          sx={{
            padding: "12px 30px",
            fontSize: "18px",
            fontWeight: "600",
            cursor: "pointer",
            backgroundColor: "#dc004e",
            color: "#fff",
            borderRadius: "8px",
            '&:hover': {
              backgroundColor: "#9a0036",
            },
          }}
        >
          Sign in with Google
        </Button>
      </Container>
    </Box>
  );
};

export default Auth;
