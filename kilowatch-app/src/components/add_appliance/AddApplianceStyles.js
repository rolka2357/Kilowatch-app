import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    pressable: {
        width: "100%",
        alignSelf: "stretch",
    },
    container: {
        width: "100%",
        height: 135,
        padding: 20,
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "flex-end",
    
        alignSelf: "stretch",
    
        borderRadius: 12,
        overflow: "hidden", // keeps gradient rounded
    },

    textContainer: {
        justifyContent: "flex-end",
        alignItems: "flex-start",
        gap: 2,
        alignSelf: "stretch",
    },

    textAdd:{
        color: "#FFF",
        fontFamily: "Roobert TRIAL",
        fontSize: 24,
        fontStyle: "normal",
        fontWeight: "500",
        lineHeight: 28,
        letterSpacing: -0.72,
        height: 26,
        alignSelf: "stretch",
    },

    textStart:{
        color: "#FFF",
        fontFamily: "Roobert TRIAL",
        fontSize: 14,
        fontStyle: "normal",
        fontWeight: "300",
        lineHeight: 20,
        letterSpacing: -0.72,
    },

    addIconContainer: {
        padding: 16,
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    
        borderRadius: 8,
        backgroundColor: "#FFF",
    }
});

export default styles;