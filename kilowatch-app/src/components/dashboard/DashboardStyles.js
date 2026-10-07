import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        height: 213,
        width: "100%",
    },

    backgroundImage: {
        borderRadius: 12,
        resizeMode: "cover",
    },

    upperContainer: {
        justifyContent: "space-between",
        alignItems: "flex-start",
        alignSelf: "stretch",
        flexDirection: "row",
        width: "100%",
    },


    textHowMuch: {
        color: "#FFF",
        fontFamily: "Roobert TRIAL",
        fontSize: 12,
        fontStyle: "normal",
        fontWeight: "400",
        lineHeight: 16,
        letterSpacing: -0.12,
    },

    textRate :{
        color: "#EFECEB",
        fontFamily: "Roobert TRIAL",
        fontSize: 12,
        fontWeight: "400",
        lineHeight: 16,
        letterSpacing: -0.12,
    },

    textDate: {
        color: "#FFF",
        fontFamily: "Roobert TRIAL",
        fontSize: 12,
        fontWeight: "400",
        lineHeight: 16,
        letterSpacing: -0.12,
    }, 

    lowerContainer: {
        justifyContent: "flex-end",
        alignItems: "flex-start",
        gap: 6,
        alignSelf: "stretch",
    },

    overlay: {
        flex: 1,

        paddingTop: 18,
        paddingHorizontal: 20,
        paddingBottom: 24,

        justifyContent: "space-between",
        alignItems: "flex-start",

        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 12,
    },

    textContainer: {
        justifyContent: "center",
        alignItems: "flex-start",
        gap: 2,
    },

    rate: {
        color: "#FFF",
        fontFamily: "Roobert TRIAL",
        fontSize: 56,
        fontWeight: "400",
        lineHeight: 64,
        letterSpacing: -0.72,
    },

    textWorth: {
        color: "#FFF",
        fontFamily: "Roobert TRIAL",
        fontSize: 12,
        fontWeight: "400",
        lineHeight: 16,
        letterSpacing: -0.12,
    },

    infoContainer: {
        alignItems: "center",
        flexDirection: "row",
        gap: 4,
        zIndex: 5,
    },

    kwhBubble: {
        backgroundColor: "rgba(0,0,0,0.88)",
    },

    kwhBubbleText: {
        color: "#FFFFFF",
    },
});

export default styles;