
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { db, storage, auth } from "../utils/firebase"; // Import your firebase config
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  Timestamp 
} from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";

export default function DashBoard() {
  const [user, setUser] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [rentedEquipment, setRentedEquipment] = useState([]);
  const [rentedOutEquipment, setRentedOutEquipment] = useState([]);
  const navigate = useNavigate();

  const navigateToAddEquipmentPage = () => {
    navigate("/register");
  };
  
  const navigateToSearchPage = () => {
    navigate("/search");
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser;

      if (currentUser) {
        setUser(currentUser);

        // Fetch user's owned equipment
        const ownedEquipmentQuery = query(
          collection(db, "user_equipment"),
          where("user_id", "==", currentUser.uid)
        );
        
        try {
          const ownedSnapshot = await getDocs(ownedEquipmentQuery);
          const ownedData = [];
          
          for (const docSnapshot of ownedSnapshot.docs) {
            const itemData = { id: docSnapshot.id, ...docSnapshot.data() };
            
            // Process image URLs
            if (itemData.image_urls && itemData.image_urls.length > 0) {
              const imageUrls = await Promise.all(
                itemData.image_urls.map(async (imagePath) => {
                  return await getImageUrl(imagePath);
                })
              );
              itemData.image_urls = imageUrls;
            }
            
            ownedData.push(itemData);
          }
          
          setEquipment(ownedData);
        } catch (error) {
          console.error("Error fetching owned equipment:", error);
        }

        // Fetch equipment rented by the user
        const rentedBookingsQuery = query(
          collection(db, "bookings"),
          where("user_id", "==", currentUser.uid),
          where("status", "!=", "completed")
        );

        try {
          const rentedSnapshot = await getDocs(rentedBookingsQuery);
          const rentedData = [];
          
          for (const bookingDoc of rentedSnapshot.docs) {
            const booking = { id: bookingDoc.id, ...bookingDoc.data() };
            
            // Get the equipment details for this booking
            const equipmentDoc = await getEquipmentById(booking.equipment_id);
            
            if (equipmentDoc) {
              const equipmentData = equipmentDoc;
              
              // Process image URLs
              if (equipmentData.image_urls && equipmentData.image_urls.length > 0) {
                const imageUrls = await Promise.all(
                  equipmentData.image_urls.map(async (imagePath) => {
                    return await getImageUrl(imagePath);
                  })
                );
                equipmentData.image_urls = imageUrls;
              }
              
              // Add booking details to equipment data
              rentedData.push({
                ...equipmentData,
                booking_details: {
                  start_date: booking.start_date,
                  end_date: booking.end_date,
                  status: booking.status,
                  cost: booking.cost,
                }
              });
            }
          }
          
          setRentedEquipment(rentedData);
        } catch (error) {
          console.error("Error fetching rented equipment:", error);
        }

        // Fetch equipment rented out by the user
        const rentedOutBookingsQuery = query(
          collection(db, "bookings"),
          where("owner_id", "==", currentUser.uid),
          where("status", "!=", "completed")
        );

        try {
          const rentedOutSnapshot = await getDocs(rentedOutBookingsQuery);
          const rentedOutData = [];
          
          for (const bookingDoc of rentedOutSnapshot.docs) {
            const booking = { id: bookingDoc.id, ...bookingDoc.data() };
            
            // Get the equipment details for this booking
            const equipmentDoc = await getEquipmentById(booking.equipment_id);
            
            if (equipmentDoc) {
              const equipmentData = equipmentDoc;
              
              // Process image URLs
              if (equipmentData.image_urls && equipmentData.image_urls.length > 0) {
                const imageUrls = await Promise.all(
                  equipmentData.image_urls.map(async (imagePath) => {
                    return await getImageUrl(imagePath);
                  })
                );
                equipmentData.image_urls = imageUrls;
              }
              
              // Add booking details to equipment data
              rentedOutData.push({
                ...equipmentData,
                booking_details: {
                  start_date: booking.start_date,
                  end_date: booking.end_date,
                  status: booking.status,
                  cost: booking.cost,
                  renter: booking.renter,
                  booking_id: booking.id, // Store booking ID for later use
                }
              });
            }
          }
          
          setRentedOutEquipment(rentedOutData);
        } catch (error) {
          console.error("Error fetching rented out equipment:", error);
        }
      }
    };

    fetchUserData();
  }, []);

  // Helper function to get equipment by ID
  const getEquipmentById = async (equipmentId) => {
    try {
      const equipmentRef = doc(db, "user_equipment", equipmentId);
      const equipmentSnap = await getDocs(equipmentRef);
      
      if (equipmentSnap.exists()) {
        return { id: equipmentSnap.id, ...equipmentSnap.data() };
      } else {
        console.log("No equipment found with ID:", equipmentId);
        return null;
      }
    } catch (error) {
      console.error("Error fetching equipment:", error);
      return null;
    }
  };

  const getImageUrl = async (path) => {
    try {
      // In Firebase Storage, we have the full URL stored
      if (path.startsWith('http')) {
        return path;
      }
      
      // If it's just a path, get the download URL
      const imageRef = ref(storage, path);
      return await getDownloadURL(imageRef);
    } catch (error) {
      console.error("Error getting image URL:", error);
      return null;
    }
  };

  const handleOpen = (item) => {
    setSelectedEquipment(item);
    setOpen(true);
  };

  const handleClose = () => {
    setSelectedEquipment(null);
    setOpen(false);
  };
  
  const handleReceiveEquipment = async (equipmentId) => {
    try {
      if (!equipmentId) {
        console.error("Missing equipmentId");
        return;
      }

      // Find the rental in our state that matches this equipment
      const rentalItem = rentedOutEquipment.find(item => item.id === equipmentId);
      
      if (!rentalItem || !rentalItem.booking_details || !rentalItem.booking_details.booking_id) {
        console.error("Could not find booking details for this equipment");
        return;
      }
      
      const bookingId = rentalItem.booking_details.booking_id;

      // Update equipment availability
      const equipmentRef = doc(db, "user_equipment", equipmentId);
      await updateDoc(equipmentRef, { 
        availability: true 
      });

      // Update booking status to "completed"
      const bookingRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingRef, {
        status: "completed",
        updated_at: Timestamp.now()
      });

      console.log("Equipment received and booking completed successfully!");
      
      // Update local state to remove this item from rented out list
      setRentedOutEquipment(prev => prev.filter(item => item.id !== equipmentId));
      
    } catch (error) {
      console.error("Error updating equipment or booking status:", error.message);
    }
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };
  return (
    <Container maxWidth="lg" sx={{ paddingTop: 4 }}>
      {user && (
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontWeight: "bold", color: "#3f51b5" }}
        >
          Welcome, {user.email.split("@")[0]}
        </Typography>
      )}

      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        sx={{ fontWeight: "bold", marginBottom: 2 }}
      >
        Your Registered Equipment
      </Typography>
      {equipment.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 4,
            margin: {
              xs: "16px", // Extra small screens
              sm: "24px", // Small screens
              md: "32px", // Medium screens
              lg: "48px", // Large screens
            },
            padding: "16px", // Added padding to help visualize space
          }}
        >
          {equipment.map((item) => (
            <Card key={item.id} sx={{ boxShadow: 3, borderRadius: 2 }}>
              {item.image_urls && item.image_urls.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    overflowX: "scroll",
                    paddingBottom: 2,
                    "&::-webkit-scrollbar": { height: "8px" },
                    "&::-webkit-scrollbar-thumb": { backgroundColor: "#888" },
                    "&::-webkit-scrollbar-thumb:hover": {
                      backgroundColor: "#555",
                    },
                  }}
                >
                  {item.image_urls.map((url, index) => (
                    <CardMedia
                      key={index}
                      component="img"
                      height="180"
                      image={url}
                      alt={item.name}
                      sx={{
                        minWidth: 300,
                        borderRadius: 1,
                        marginRight: 2,
                        "&:hover": {
                          transform: "scale(1.05)",
                          transition: "transform 0.3s ease",
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
              <CardContent>
                <Typography
                  gutterBottom
                  variant="h5"
                  component="div"
                  sx={{ fontWeight: "bold" }}
                >
                  {item.brand} {item.model}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Category:{" "}
                  <span style={{ fontWeight: "normal" }}>{item.category}</span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Rental Price:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    ₹{item.rental_price}
                  </span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Village:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    {item?.village_name || "NA"}
                  </span>
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: "center" }}>
                <Button
                  size="small"
                  color="primary"
                  variant="contained"
                  onClick={() => handleOpen(item)}
                >
                  View
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #888",
            borderRadius: 2,
            padding: 4,
            marginTop: 4,
            backgroundColor: "#f9f9f9",
            boxShadow: 2,
          }}
        >
          <Typography
            variant="h6"
            color="text.primary"
            sx={{ textAlign: "center", fontWeight: "bold", marginBottom: 2 }}
          >
            No Equipment Registered{" "}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ textAlign: "center", maxWidth: "600px", marginBottom: 2 }}
          >
            You havent Registered any equipment yet. Start by listing your
            equipment
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ marginTop: 2 }}
            onClick={() => navigateToAddEquipmentPage()}
          >
            Add Your Equipment
          </Button>
        </Box>
      )}
      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        sx={{ fontWeight: "bold", marginBottom: 2 }}
      >
        Equipment You Have Rented
      </Typography>
      {rentedEquipment.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 4,
            margin: {
              xs: "16px", // Extra small screens
              sm: "24px", // Small screens
              md: "32px", // Medium screens
              lg: "48px", // Large screens
            },
            padding: "16px", // Added padding to help visualize space
          }}
        >
          {rentedEquipment.map((item) => (
            <Card key={item.id} sx={{ boxShadow: 3, borderRadius: 2 }}>
              {item.image_urls && item.image_urls.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    overflowX: "scroll",
                    paddingBottom: 2,
                    "&::-webkit-scrollbar": { height: "8px" },
                    "&::-webkit-scrollbar-thumb": { backgroundColor: "#888" },
                    "&::-webkit-scrollbar-thumb:hover": {
                      backgroundColor: "#555",
                    },
                  }}
                >
                  {item.image_urls.map((url, index) => (
                    <CardMedia
                      key={index}
                      component="img"
                      height="180"
                      image={url}
                      alt={item.name}
                      sx={{
                        minWidth: 300,
                        borderRadius: 1,
                        marginRight: 2,
                        "&:hover": {
                          transform: "scale(1.05)",
                          transition: "transform 0.3s ease",
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
              <CardContent>
                <Typography
                  gutterBottom
                  variant="h5"
                  component="div"
                  sx={{ fontWeight: "bold" }}
                >
                  {item.brand} {item.model}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Category:{" "}
                  <span style={{ fontWeight: "normal" }}>{item.category}</span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Rental Price:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    ₹{item.rental_price}
                  </span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Location:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    {item?.location || "NA"}
                  </span>
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: "center" }}>
                <Button
                  size="small"
                  color="primary"
                  variant="contained"
                  onClick={() => handleOpen(item)}
                >
                  View
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #888",
            borderRadius: 2,
            padding: 4,
            marginTop: 4,
            backgroundColor: "#f9f9f9",
            boxShadow: 2,
          }}
        >
          <Typography
            variant="h6"
            color="text.primary"
            sx={{ textAlign: "center", fontWeight: "bold", marginBottom: 2 }}
          >
            No Equipment Rented{" "}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ textAlign: "center", maxWidth: "600px", marginBottom: 2 }}
          >
            You haven't rented any equipment yet. Start by Exploring the
            equipment available for rent
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ marginTop: 2 }}
            onClick={() => navigateToSearchPage()}
          >
            Add Your Equipment
          </Button>
        </Box>
      )}
      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        sx={{ fontWeight: "bold", marginBottom: 2 }}
      >
        Equipment You Have Rented Out
      </Typography>
      {rentedOutEquipment.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 4,
            margin: {
              xs: "16px", // Extra small screens
              sm: "24px", // Small screens
              md: "32px", // Medium screens
              lg: "48px", // Large screens
            },
            padding: "16px", // Added padding to help visualize space
          }}
        >
          {rentedOutEquipment.map((item) => (
            <Card key={item.id} sx={{ boxShadow: 3, borderRadius: 2 }}>
              {item.image_urls && item.image_urls.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    overflowX: "scroll",
                    paddingBottom: 2,
                    "&::-webkit-scrollbar": { height: "8px" },
                    "&::-webkit-scrollbar-thumb": { backgroundColor: "#888" },
                    "&::-webkit-scrollbar-thumb:hover": {
                      backgroundColor: "#555",
                    },
                  }}
                >
                  {item.image_urls.map((url, index) => (
                    <CardMedia
                      key={index}
                      component="img"
                      height="180"
                      image={url}
                      alt={item.name}
                      sx={{
                        minWidth: 300,
                        borderRadius: 1,
                        marginRight: 2,
                        "&:hover": {
                          transform: "scale(1.05)",
                          transition: "transform 0.3s ease",
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
              <CardContent>
                <Typography
                  gutterBottom
                  variant="h5"
                  component="div"
                  sx={{ fontWeight: "bold" }}
                >
                  {item.brand} {item.model}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Category:{" "}
                  <span style={{ fontWeight: "normal" }}>{item.category}</span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Rental Price:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    ₹{item.rental_price}
                  </span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Location:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    {item?.village_name || "N/A"}
                  </span>
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: "center" }}>
                <Button
                  size="small"
                  color="primary"
                  variant="contained"
                  onClick={() => handleOpen(item)}
                >
                  View
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #888",
            borderRadius: 2,
            padding: 4,
            marginTop: 4,
            backgroundColor: "#f9f9f9",
            boxShadow: 2,
          }}
        >
          <Typography
            variant="h6"
            color="text.primary"
            sx={{ textAlign: "center", fontWeight: "bold", marginBottom: 2 }}
          >
            No Equipment Rented Out Yet
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ textAlign: "center", maxWidth: "600px", marginBottom: 2 }}
          >
            You haven't rented out any equipment yet. Start by listing your
            equipment to make it available for renting and see your listed
            equipment here!
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ marginTop: 2 }}
            onClick={() => navigateToAddEquipmentPage()}
          >
            Add Your Equipment
          </Button>
        </Box>
      )}
      {/* Popup Dialog */}
      {/* Popup Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            fontWeight: "bold",
            fontSize: "1.5rem",
            color: "#3f51b5",
            textAlign: "center",
          }}
        >
          {selectedEquipment?.brand} {selectedEquipment?.model}
        </DialogTitle>
        <DialogContent>
          {/* Scrollable Image Gallery */}
          {selectedEquipment?.image_urls &&
            selectedEquipment.image_urls.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  overflowX: "scroll",
                  marginBottom: 2,
                  "&::-webkit-scrollbar": { height: "8px" },
                  "&::-webkit-scrollbar-thumb": { backgroundColor: "#888" },
                  "&::-webkit-scrollbar-thumb:hover": {
                    backgroundColor: "#555",
                  },
                }}
              >
                {selectedEquipment.image_urls.map((url, index) => (
                  <CardMedia
                    key={index}
                    component="img"
                    height="200"
                    image={url}
                    alt={selectedEquipment.name}
                    sx={{
                      borderRadius: 2,
                      marginRight: 2,
                      boxShadow: 2,
                      "&:hover": {
                        transform: "scale(1.05)",
                        transition: "transform 0.3s ease",
                      },
                    }}
                  />
                ))}
              </Box>
            )}

          {/* Equipment Details */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              padding: 2,
              backgroundColor: "#f9f9f9",
              borderRadius: 2,
              boxShadow: 2,
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Description:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.description || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Category:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.category || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Rental Price:{" "}
              <span style={{ fontWeight: "normal" }}>
                ₹{selectedEquipment?.rental_price || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Landmark/Location:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.location || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Village:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.village_name || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              District:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.district_name || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              State:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.state_name || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Age (Years):{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.age_years || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Availability:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.availability ? "Available" : "Unavailable"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              For Rent:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.for_rent ? "Yes" : "No"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Condition:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.condition || "N/A"}/10
              </span>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            variant="contained"
            sx={{
              backgroundColor: "#3f51b5",
              color: "#fff",
              "&:hover": { backgroundColor: "#303f9f" },
            }}
          >
            Close
          </Button>
          {selectedEquipment && !selectedEquipment.availability && (
            <Button
              onClick={() => handleReceiveEquipment(selectedEquipment.id)}
              variant="contained"
              color="success"
            >
              Receive
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
