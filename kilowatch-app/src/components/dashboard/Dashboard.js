import { View, Text, ImageBackground } from "react-native";
import Morning from "../../../assets/images/morning_dashboard.png";
import InfoIcon from "../../../assets/svg/shared/info_icon.svg";
import KwhTip from "../shared/KwhTip";
import {
    PHP_PER_KWH,
    formatKwh,
    formatPhpFromKwh,
} from "../../firebase/energyPricing";
import styles from "./DashboardStyles";

export default function Dashboard({ kwh = 0, rate = PHP_PER_KWH }) {
    const date = new Intl.DateTimeFormat("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date());

    return(
        <ImageBackground
            source={Morning}
            style={styles.container}
            imageStyle={styles.backgroundImage}
        >
            {/* Black overlay */}
            <View style={styles.overlay}>
                <View style={styles.upperContainer}>
                    <View style={styles.textContainer}>
                        <Text style={styles.textHowMuch}>How much you’ve used today</Text>
                        <Text style={styles.textRate}>
                            Rate: ₱{Number(rate).toFixed(2)}/kWh
                        </Text>
                    </View>
                    <Text style={styles.textDate}>{date}</Text>
                </View>

                <View style={styles.lowerContainer}>
                    <Text style={styles.rate}>{formatPhpFromKwh(kwh, rate)}</Text>
                    <View style={styles.infoContainer}>
                        <Text style={styles.textWorth}>
                            {formatKwh(kwh)} used today
                        </Text>
                        <KwhTip
                          kwh={kwh}
                          bubbleStyle={styles.kwhBubble}
                          textStyle={styles.kwhBubbleText}
                        >
                          <InfoIcon width={12} height={12} />
                        </KwhTip>
                    </View>
                </View>
            </View>
        </ImageBackground>
    );
}
