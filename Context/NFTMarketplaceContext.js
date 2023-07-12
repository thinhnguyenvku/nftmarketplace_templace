import React, { useState, useEffect, useContext } from 'react';

import Wenb3Modal from 'web3modal';
import { ethers } from 'ethers';
import Router from 'next/router';
import axios from 'axios';
import { create as ifpsHttpClient } from 'ipfs-http-client';

const client = ifpsHttpClient("https://ipfs.infura.io:5001/api/v0");

import { NFTMarketplaceAddress, NFTMarketplaceABI } from './NFTMarketplace.json';

const fetchContract = (signerOrProvider) => new ethers.Contract(NFTMarketplaceAddress, NFTMarketplaceABI, signerOrProvider);

const connectingWithSmartContract = async () => {
    try {
        const web3modal = new Wenb3Modal();
        const connection = await web3modal.connect();
        const provider = new ethers.providers.Web3Provider(connection);
        const signer = provider.getSigner();
        const contract = fetchContract(signer);
        return contract;
    } catch (error) {
        console.log("Something went wrong while connecting with contract");
    }
};

export const NFTMarketplaceContext = React.createContext();

export const NFTMarketplaceProvider = ({ children }) => {
    const titleData = "Discover, collect, sell NFTs";

    const [currentAccount, setCurrentAccount] = useState("");

    const checkIfWalletConnected = async () => {
        try {
            if (!window.ethereum) return console.log("Install MetaMask");

            const accounts = await window.ethereum.request({
                method: "eth_accounts",
            });

            if (accounts.length) {
                setCurrentAccount(accounts[0]);
            } else {
                console.log("No Account Found");
            }

        } catch (error) {
            console.log("Something wrong while connecting to wallet!");
        }
    };

    useEffect(() => {
        checkIfWalletConnected();
    }, []);

    const connectWallet = async () => {
        try {
            if (!window.ethereum) return console.log("Install MetaMask");

            const accounts = await window.ethereum.request({
                method: "eth_requestAccount",
            });

            setCurrentAccount(accounts[0]);
            window.location.reload();

        } catch (error) {
            console.log("Error while connecting to wallet");
        }
    };

    const uploadToIPFS = async (file) => {
        try {
            const added = await client.add({ content: file });
            const url = `https://ipfs.infura.io/ipfs/${added.path}`;

            return url;
        } catch (error) {
            console.log("Error Uploading to IPFS");
        }
    };

    const createNFT = async (formInput, fileUrl, router) => {
        const { name, description, price } = formInput;

        if (!name || !description || !price || !fileUrl)
            return console.log("Data is missing");

        const data = JSON.stringify({ name, description, image: fileUrl });

        try {
            const added = await client.add(data);

            const url = `http://ipfs.infura.io/ipfs/${added.path}`;

            await createSale(url, price);
        } catch (error) {
            console.log(error);
        }
    }

    const createSale = async ({ url, formInputPrice, isReselling, id }) => {
        try {
            const price = ethers.utils.parseUnits(formInputPrice, "ether");
            const contract = await connectingWithSmartContract();

            const listingPrice = await contract.getListingPrice();

            const transaction = !isReselling
                ? await contract.createToken(url, price,
                    {
                        value: listingPrice.toString(),
                    })
                : await contract.reSellToken(url, price,
                    {
                        value: listingPrice.toString(),
                    }
                );

            await transaction.wait();
        } catch (error) {
            console.log("Error while creating sale");
        }
    }

    const fetchNFTs = async () => {
        try {
            const provider = new ethers.providers.JsonRpcProvider();
            const contract = fetchContract(provider);

            const data = await contract.fetchMarketItem();

            const items = await Promise.all(
                data.map(
                    async ({ tokenId, seller, owner, price: unformattedPrice }) => {
                        const tokenURI = await contract.tokenURI(tokenId);

                        const {
                            data: { image, name, description },
                        } = await axios.get(tokenURI);
                        const price = ethers.utils.formatUnits(
                            unformattedPrice.toString(),
                            "ether"
                        );

                        return {
                            price,
                            tokenId: tokenId.toNumber(),
                            seller,
                            owner,
                            image,
                            name,
                            description,
                            tokenURI,
                        };
                    }
                )
            );

            return items;
        } catch (error) {
            console.log("Error while fetching NFTs");
        }
    }

    const fetchMyNFTsOrListedNFTs = async (type) => {
        try {
            const contract = await connectingWithSmartContract();

            const data = type == "fetchItemsListed"
                ? await contract.fetchItemsListed()
                : await contract.fetchMyNFT();

            const items = await Promise.all(
                data.map(
                    async ({ tokenId, seller, owner, price: unformattedPrice }) => {
                        const tokenURI = await contract.tokenURI(tokenId);
                        const {
                            data: { image, name, description },
                        } = await axios.get(tokenURI);

                        const price = ethers.utils.formatUnits(
                            unformattedPrice.toString(),
                            "ether"
                        );

                        return {
                            price,
                            tokenId: tokenId.toNumber(),
                            seller,
                            owner,
                            image,
                            name,
                            description,
                            tokenURI,
                        }
                    }
                )
            );

            return items;
        } catch (error) {
            console.log("Error while fetching listed NFTs");
        }
    }

    const buyNFT = async(nft) => {
        try {
            const contract = await connectingWithSmartContract();
            const price = ethers.utils.parseUnits(
                nft.price.toString(), 
                "ether"
            );

            const transaction = await contract.createMarketSale(nft.tokenId, {
                value: price,
            });

            await transaction.wait();
        } catch (error) {
            console.log("Error while buying NFT");
        }
    }



    return (
        <NFTMarketplaceContext.Provider value={{
            checkIfWalletConnected,
            connectWallet,
            uploadToIPFS,
            createNFT,
            fetchNFTs,
            fetchMyNFTsOrListedNFTs,
            buyNFT,
            currentAccount,
            titleData
        }}>
            {children}
        </NFTMarketplaceContext.Provider>
    );
}