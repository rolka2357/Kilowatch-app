import { useEffect, useState } from "react";
import { View, Text, Pressable, Image, TextInput, ActivityIndicator } from "react-native";
import { createLoginStyles } from "./LoginStyles";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";
import GoogleIcon from "../../../../assets/svg/shared/google_icon.svg"
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../../firebase/firebaseConfig";
import {
    getGoogleSignInErrorMessage,
    initGoogleSignIn,
    signInWithGoogle,
    signOutGoogle,
} from "../../../firebase/googleSignIn";
import {
    ACCOUNT_DISABLED_CODE,
    ACCOUNT_DISABLED_MESSAGE,
    assertAccountActive,
} from "../../../firebase/accountAccess";
import PasswordInput from "../../../components/password_input/PasswordInput";
import { userFacingError } from "../../../utils/userFacingError";

export default function Login({ navigation }) {
    const { colors } = useTheme();
    const styles = useThemedStyles(createLoginStyles);

    const [form, setForm] = useState({
        email: "",
        password: "",
    });
    
    const [errors, setErrors] = useState({
        email: "",
        password: "",
        firebase: "",
    });
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleStatus, setGoogleStatus] = useState("");

    useEffect(() => {
      initGoogleSignIn().catch(() => {});
    }, []);

    const validateField = (field, value) => {
        switch (field) {
            case "email":
                if (!value.trim()) return "Email is required.";
                return "";
    
            case "password":
                if (!value.trim()) return "Password is required.";
                return "";
    
            default:
                return "";
        }
    };

    const handleChange = (field, value) => {
        setForm(prev => ({
            ...prev,
            [field]: value,
        }));
    
        setErrors(prev => ({
            ...prev,
            [field]: validateField(field, value),
            firebase: "",
        }));
    };

    const handleLogin = async () => {
        if (loading || googleLoading) return;

        const newErrors = {
            email: validateField("email", form.email),
            password: validateField("password", form.password),
            firebase: "",
        };
    
        setErrors(newErrors);
    
        if (Object.values(newErrors).some(error => error !== "")) {
            return;
        }

        setLoading(true);
    
        try {
    
            const userCredential = await signInWithEmailAndPassword(
                auth,
                form.email,
                form.password
            );

            try {
                await assertAccountActive(userCredential.user.uid);
            } catch (disabledError) {
                await signOut(auth);
                throw disabledError;
            }
    
            alert("Login successful!");
    
            // navigation.replace("Home");
    
        } catch (error) {
    
            let message = "Login failed.";
    
            switch (error.code) {

                case ACCOUNT_DISABLED_CODE:
                case "auth/user-disabled":
                    message = ACCOUNT_DISABLED_MESSAGE;
                    break;
    
                case "auth/user-not-found":
                    message = "No account found with this email.";
                    break;
    
                case "auth/invalid-credential":
                    message = "Incorrect email or password.";
                    break;
    
                case "auth/wrong-password":
                    message = "Incorrect password.";
                    break;
    
                case "auth/invalid-email":
                    message = "Invalid email address.";
                    break;
    
                case "auth/network-request-failed":
                    message = "Please check your internet connection.";
                    break;
    
                default:
                    message = userFacingError(error);
            }
    
            setErrors(prev => ({
                ...prev,
                firebase: message,
            }));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (loading || googleLoading) return;

        setGoogleLoading(true);
        setGoogleStatus("Opening Google…");
        setErrors((prev) => ({ ...prev, firebase: "" }));

        try {
            await signInWithGoogle();
        } catch (error) {
            if (error?.code === ACCOUNT_DISABLED_CODE) {
                await signOutGoogle().catch(() => undefined);
                await signOut(auth).catch(() => undefined);
            }
            const message = getGoogleSignInErrorMessage(error);
            if (message) {
                setErrors((prev) => ({
                    ...prev,
                    firebase: userFacingError(
                        { ...error, message },
                        "Something went wrong. Please try again."
                    ),
                }));
            }
        } finally {
            setGoogleLoading(false);
            setGoogleStatus("");
        }
    };

    const busy = loading || googleLoading;

    return (
        <View
            style={styles.container}
        >
            <Image
                source={require("../../../../assets/kilowatch_logo.png")}
                style={styles.logo}
            />
            <View style={styles.loginFormContainer}>
                <View style={styles.navigationContainer}>

                    {/* LOGIN */}
                    <Pressable style={[styles.navigationButton, styles.activeNavigationButton]}
                                >
                        <Text style={styles.activeNavigationText}>Log In</Text>
                    </Pressable>

                    {/* REGISTER */}
                    <Pressable style={styles.navigationButton}
                                onPress={()=>{navigation.navigate("Register")}}>
                        <Text style={styles.navigationText}>Register Account</Text>
                    </Pressable>

                </View>
                <View style={styles.formForgetContainer}>
                    <View style={styles.formContainer}>
                        <View style={styles.textInputContainer}>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Email"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={form.email}
                                    onChangeText={(text) => handleChange("email", text)}
                                />

                                <Text style={styles.errorMessage}>
                                    {errors.email}
                                </Text>
                            </View>

                            <View style={styles.inputContainer}>
                                <PasswordInput
                                    style={styles.textInput}
                                    placeholder="Password"
                                    value={form.password}
                                    onChangeText={(text) => handleChange("password", text)}
                                />

                                <Text style={styles.errorMessage}>
                                    {errors.password}
                                </Text>
                            </View>
                        </View>

                        {errors.firebase !== "" && (
                            <Text style={styles.errorMessageFirebase}>
                                {errors.firebase}
                            </Text>
                        )}

                        <Pressable
                            style={[
                                styles.loginButton,
                                busy && styles.loginButtonDisabled,
                            ]}
                            onPress={handleLogin}
                            disabled={busy}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.loginButtonText}>
                                    Log In
                                </Text>
                            )}
                        </Pressable>
                    </View>
                    <Pressable
                        onPress={() =>
                            navigation.navigate("ForgotPassword", {
                                email: form.email.trim(),
                            })
                        }
                        disabled={busy}
                    >
                        <Text style={styles.forgotPasswordText}>
                            Forgot your Password?
                        </Text>
                    </Pressable>
                </View>
                <View style={styles.orSignInContainer}>
                    <Text style={styles.signInUsing}>
                        {googleStatus || "Or sign in using"}
                    </Text>
                    <View>
                        <Pressable
                            style={styles.iconContainer}
                            onPress={handleGoogleLogin}
                            disabled={busy}
                        >
                            {googleLoading ? (
                                <ActivityIndicator color="#FE6023" />
                            ) : (
                                <GoogleIcon />
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>

        </View>
    );
}