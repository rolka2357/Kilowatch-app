import { View, Text, Pressable, Image, TextInput, ActivityIndicator } from "react-native";
import {useState} from 'react'
import { createRegisterStyles } from "./RegisterStyles";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebase/firebaseConfig";
import { database } from "../../../firebase/firebaseConfig";
import { ref, set } from "firebase/database";
import PasswordInput from "../../../components/password_input/PasswordInput";
import { userFacingError } from "../../../utils/userFacingError";

export default function Register({ navigation }) {
    const { colors } = useTheme();
    const styles = useThemedStyles(createRegisterStyles);
    const [checked, setChecked] = useState(false);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [errors, setErrors] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        terms: "",
        firebase: "",
    });

    const validateField = (field, value, currentForm = form) => {
        switch (field) {
            case "name":
                if (!value.trim()) return "Name is required.";
                if (value.trim().length < 3)
                    return "Name must be at least 3 characters.";
                return "";
    
            case "email":
                if (!value.trim()) return "Email is required.";
    
                if (
                    !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
                ) {
                    return "Please enter a valid email.";
                }
    
                return "";
    
            case "password":
                if (!value) return "Password is required.";
    
                if (value.length < 8)
                    return "Password must be at least 8 characters.";
    
                if (!/[A-Z]/.test(value))
                    return "Password must contain at least one uppercase letter.";
    
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(value))
                    return "Password must contain at least one symbol.";
    
                return "";
    
            case "confirmPassword":
                if (!value)
                    return "Please confirm your password.";
    
                if (value !== currentForm.password)
                    return "Passwords do not match.";
    
                return "";
    
            default:
                return "";
        }
    };

    const handleChange = (field, value) => {
        const updatedForm = {
            ...form,
            [field]: value,
        };
    
        setForm(updatedForm);
    
        setErrors(prev => ({
            ...prev,
            [field]: validateField(field, value, updatedForm),
    
            ...(field === "password" && {
                confirmPassword: validateField(
                    "confirmPassword",
                    updatedForm.confirmPassword,
                    updatedForm
                ),
            }),
        }));
    };

    const handleRegister = async () => {

        const newErrors = {
            name: validateField("name", form.name, form),
            email: validateField("email", form.email, form),
            password: validateField("password", form.password, form),
            confirmPassword: validateField(
                "confirmPassword",
                form.confirmPassword,
                form
            ),
            terms: checked ? "" : "Please accept the Terms and Conditions.",
            firebase: "",
        };
    
        setErrors(newErrors);
    
        if (Object.values(newErrors).some(error => error !== "")) {
            return;
        }

        setLoading(true);
    
        try {
    
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                form.email,
                form.password
            );
            
            const user = userCredential.user;
            
            await set(
                ref(database, `users/${user.uid}`),
                {
                    fullName: form.name,
                    email: form.email,
                    emailKey: form.email.trim().toLowerCase().replace(/[.#$\[\]]/g, "_"),
                    createdAt: Date.now(),
                }
            );

            await set(
                ref(database, `emailIndex/${form.email.trim().toLowerCase().replace(/[.#$\[\]]/g, "_")}`),
                user.uid
            );
            
            alert("Registration successful!");
    
        } catch (error) {
            
            console.log(error);
            console.log(error.code);
        
            let message = "Registration failed.";
    
            switch (error.code) {
    
                case "auth/email-already-in-use":
                    message = "This email is already registered.";
                    break;
    
                case "auth/invalid-email":
                    message = "Invalid email address.";
                    break;
    
                case "auth/weak-password":
                    message = "Password is too weak.";
                    break;
    
                case "auth/network-request-failed":
                    message = "Please check your internet connection.";
                    break;

                default:
                    message = userFacingError(error, "Registration failed.");
            }
    
            setErrors(prev => ({
                ...prev,
                firebase: message,
            }));
        } finally {
            setLoading(false);
        }
    };

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
                    <Pressable style={[styles.navigationButton]}
                                onPress={()=>{navigation.goBack()}}>
                        <Text style={styles.navigationText}>Log In</Text>
                    </Pressable>

                    {/* REGISTER */}
                    <Pressable style={[styles.navigationButton, styles.activeNavigationButton]}
                                >
                        <Text style={styles.activeNavigationText}>Register Account</Text>
                    </Pressable>

                </View>
                <View style={styles.formForgetContainer}>
                    <View style={styles.formContainer}>
                        <View style={styles.textInputContainer}>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="What should we call you?"
                                    placeholderTextColor={colors.textMuted}
                                    value={form.name}
                                    onChangeText={(text) => handleChange("name", text)}
                                />

                                <Text style={styles.errorMessage}>
                                    {errors.name}
                                </Text>
                            </View>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Please enter an email"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
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
                                    placeholder="Create a Password"
                                    value={form.password}
                                    onChangeText={(text) => handleChange("password", text)}
                                />

                                <Text style={styles.errorMessage}>
                                    {errors.password}
                                </Text>
                            </View>

                            <View style={styles.inputContainer}>
                                <PasswordInput
                                    style={styles.textInput}
                                    placeholder="Confirm Password"
                                    value={form.confirmPassword}
                                    onChangeText={(text) => handleChange("confirmPassword", text)}
                                />

                                <Text style={styles.errorMessage}>
                                    {errors.confirmPassword}
                                </Text>
                            </View>

                        </View>

                        <View style={styles.termsContainer}>
                            {/* CHECKBOX */}
                            <Pressable
                                onPress={() => {
                                    setChecked((prev) => !prev);
                                    setErrors((current) =>
                                        current.terms ? { ...current, terms: "" } : current
                                    );
                                }}
                                style={[
                                    styles.checkBox,
                                    { backgroundColor: checked ? '#FE6023' : '#FFF' }
                                ]}
                                >
                                {checked && (
                                    <Text style={{ color: '#FFF', fontSize: 14 }}>✓</Text>
                                )}
                            </Pressable>
                            <Text style={styles.termsText}>
                                By signing up you agree to our{' '}
                                <Text style={styles.highlightText}>Terms and Conditions</Text>
                                {' '}and{' '}
                                <Text style={styles.highlightText}>Privacy Policy</Text>
                            </Text>
                        </View>
                        {errors.terms ? (
                            <Text style={styles.errorMessage}>{errors.terms}</Text>
                        ) : null}

                    </View>
                    {errors.firebase !== "" && (
                        <Text style={styles.errorMessageFirebase}>
                            {errors.firebase}
                        </Text>
                    )}
                    <Pressable
                        style={[
                            styles.registerButton,
                            loading && styles.registerButtonDisabled,
                        ]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.registerButtonText}>
                                Register Account
                            </Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </View>
    );
}